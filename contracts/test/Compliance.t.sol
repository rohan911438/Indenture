// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IndentureTest} from "./utils/IndentureTest.sol";
import {CompliancePolicy, IIdentityRegistry, IModularCompliance} from "../src/policies/CompliancePolicy.sol";
import {MandateComplianceModule, IBreachSource} from "../src/compliance/MandateComplianceModule.sol";
import {PolicyHook} from "../src/PolicyHook.sol";
import {IPolicy} from "../src/interfaces/IPolicy.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";

/// @dev Stands in for the ATS `IdentityRegistry`. The real one is deployed by
///      the hashgraph/asset-tokenization-sdk against a live network (Sprint 5), so
///      it cannot participate in an offline suite. CompliancePolicy depends on
///      exactly one function of it, which is what makes this substitution safe.
contract MockIdentityRegistry is IIdentityRegistry {
    mapping(address => bool) public verified;

    function setVerified(address a, bool v) external {
        verified[a] = v;
    }

    function isVerified(address a) external view returns (bool) {
        return verified[a];
    }
}

/// @dev Stands in for the ATS `ModularCompliance`, and actually runs the real
///      MandateComplianceModule so the breach cross-link is exercised rather
///      than assumed.
contract MockModularCompliance is IModularCompliance {
    MandateComplianceModule public module;
    uint256 public hardCap = type(uint256).max;

    function setModule(MandateComplianceModule m) external {
        module = m;
    }

    function setHardCap(uint256 c) external {
        hardCap = c;
    }

    function canTransfer(address from, address to, uint256 amount) external view returns (bool) {
        if (amount > hardCap) return false;
        if (address(module) == address(0)) return true;
        return module.moduleCheck(from, to, amount, address(this));
    }
}

/// A verified wallet buys; an unverified one is refused. One test per named
/// revert error.
contract ComplianceTest is IndentureTest {
    using PoolIdLibrary for PoolKey;

    MockIdentityRegistry internal registry;
    MockModularCompliance internal modularCompliance;
    MandateComplianceModule internal breachModule;
    CompliancePolicy internal compliancePolicy;

    function setUp() public override {
        super.setUp();

        registry = new MockIdentityRegistry();
        modularCompliance = new MockModularCompliance();
        breachModule = new MandateComplianceModule(IBreachSource(address(policy)), address(modularCompliance));
        modularCompliance.setModule(breachModule);

        compliancePolicy = new CompliancePolicy(
            IIdentityRegistry(address(registry)),
            IModularCompliance(address(modularCompliance)),
            address(hook)
        );

        registry.setVerified(address(vault), true);
    }

    function test_VerifiedWallet_CanSwap() public {
        vm.prank(address(hook));
        bytes4 sel =
            compliancePolicy.beforeSwap(address(vault), poolId, poolKey, _sellParams(-1e15), "");

        assertEq(sel, IPolicy.beforeSwap.selector);
    }

    function test_UnverifiedWallet_Reverts_NotVerified() public {
        address stranger = makeAddr("unverifiedWallet");

        vm.expectEmit(true, false, false, true, address(compliancePolicy));
        emit CompliancePolicy.ComplianceRefused(stranger, "notVerified");

        vm.prank(address(hook));
        vm.expectRevert(abi.encodeWithSelector(CompliancePolicy.NotVerified.selector, stranger));
        compliancePolicy.beforeSwap(stranger, poolId, poolKey, _sellParams(-1e15), "");
    }

    function test_NonCompliantTransfer_Reverts_TransferNotCompliant() public {
        modularCompliance.setHardCap(1e14); // below the trade size

        vm.prank(address(hook));
        vm.expectRevert(
            abi.encodeWithSelector(
                CompliancePolicy.TransferNotCompliant.selector, address(hook), address(vault), uint256(1e15)
            )
        );
        compliancePolicy.beforeSwap(address(vault), poolId, poolKey, _sellParams(-1e15), "");
    }

    function test_UnregisteredPool_Reverts_NoPolicyForPool() public {
        // A pool with no policy must be refused outright, never waved through.
        // This is the fail-closed property of the routing table.
        //
        // PoolId is derived from the key, so an unregistered pool is made by
        // changing the key — here the fee tier — and letting the id follow.
        PoolKey memory otherPool = poolKey;
        otherPool.fee = 500; // the fixture registered the 3000 tier
        PoolId unregistered = otherPool.toId();
        assertTrue(PoolId.unwrap(unregistered) != PoolId.unwrap(poolId), "fixture pools collided");

        vm.prank(address(manager));
        vm.expectRevert(abi.encodeWithSelector(PolicyHook.NoPolicyForPool.selector, unregistered));
        hook.beforeSwap(address(vault), otherPool, _sellParams(-1e15), "");
    }

    function test_CallerMustBePolicyHook() public {
        vm.prank(fundManager);
        vm.expectRevert(CompliancePolicy.NotPolicyHook.selector);
        compliancePolicy.beforeSwap(address(vault), poolId, poolKey, _sellParams(-1e15), "");
    }

    // --- the breach cross-link -------------------------------------------
    //
    // This is what turns an off-mandate portfolio into a consequence rather
    // than a log line: MandateComplianceModule reads MandatePolicy.inBreach(),
    // so a breached portfolio freezes the whole share class.

    function test_PortfolioBreach_FreezesTheShareClass() public {
        assertTrue(
            modularCompliance.canTransfer(address(1), address(2), 1),
            "transfers should be allowed while the mandate is honoured"
        );

        vm.prank(address(vault));
        policy.observeSnapshot(1_000_000, 411_000, 200_000, PoolId.unwrap(poolId)); // 4110bps vs 3000
        assertTrue(policy.inBreach());

        assertFalse(
            modularCompliance.canTransfer(address(1), address(2), 1),
            "a portfolio breach must freeze the share class"
        );

        // And the freeze lifts once the portfolio is back inside the mandate.
        vm.prank(address(vault));
        policy.observeSnapshot(1_000_000, 250_000, 200_000, PoolId.unwrap(poolId));
        assertTrue(modularCompliance.canTransfer(address(1), address(2), 1));
    }

    function test_BreachAlsoBlocksASwapThroughCompliancePolicy() public {
        vm.prank(address(vault));
        policy.observeSnapshot(1_000_000, 411_000, 200_000, PoolId.unwrap(poolId));

        vm.prank(address(hook));
        vm.expectRevert(); // TransferNotCompliant — the module refuses while in breach
        compliancePolicy.beforeSwap(address(vault), poolId, poolKey, _sellParams(-1e15), "");
    }
}
