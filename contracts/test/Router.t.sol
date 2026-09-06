// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IndentureTest} from "./utils/IndentureTest.sol";
import {IndentureVault} from "../src/IndentureVault.sol";
import {PolicyHook} from "../src/PolicyHook.sol";
import {IPolicy} from "../src/interfaces/IPolicy.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId} from "v4-core/types/PoolId.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {IERC20Minimal} from "v4-core/interfaces/external/IERC20Minimal.sol";

/// @dev A vault that swaps and then does not settle. Exists only to prove the
///      NonZeroDelta guard in the real vault is reachable.
contract NoSettleVault is IndentureVault {
    constructor(address o, IPoolManager pm, address m) IndentureVault(o, pm, m) {}

    function _settleAll(PoolKey memory, BalanceDelta) internal pure override {
        // deliberately nothing
    }
}

/// The vault-as-router. Every branch must settle to exactly zero deltas.
/// Runs entirely on anvil against a real PoolManager and a real hook.
contract RouterTest is IndentureTest {
    function test_Trade_SettlesToZeroDeltas() public {
        // Sized well inside the fixture's in-range liquidity so the swap fills
        // exactly. At 1e18 it would stop at the price limit and partially fill,
        // which is correct v4 behaviour but tests nothing about settlement.
        IPoolManager.SwapParams memory params = _sellParams(-1e15);

        uint256 before0 = _balOf(currency0, address(vault));
        uint256 before1 = _balOf(currency1, address(vault));

        _trade(params, _signedFor(params));

        assertEq(before0 - _balOf(currency0, address(vault)), 1e15, "exact-in amount did not leave the vault");
        assertGt(_balOf(currency1, address(vault)), before1, "vault received no output");

        // Flat: unlockCallback reverts NonZeroDelta otherwise, and the vault
        // holds no ERC-6909 claims because it always takes real tokens.
        assertEq(manager.balanceOf(address(vault), currency0.toId()), 0, "leftover currency0 claim");
        assertEq(manager.balanceOf(address(vault), currency1.toId()), 0, "leftover currency1 claim");
    }

    function test_Trade_EmitsExecutedWithReceiptSeq() public {
        IPoolManager.SwapParams memory params = _sellParams(-1e15);

        // Check both indexed topics; the amounts depend on pool state.
        vm.expectEmit(true, true, false, false, address(vault));
        emit IndentureVault.Executed(0, PoolId.unwrap(poolId), 0, 0);

        _trade(params, _signedFor(params));
    }

    function test_Trade_OnlyManager_Reverts_NotManager() public {
        IPoolManager.SwapParams memory params = _sellParams(-1e15);
        bytes memory blob = _signedFor(params);

        vm.prank(fundOwner); // the owner is NOT the manager
        vm.expectRevert(IndentureVault.NotManager.selector);
        vault.trade(poolKey, params, blob);
    }

    function test_UnlockCallback_OnlyPoolManager_Reverts_NotPoolManager() public {
        vm.expectRevert(IndentureVault.NotPoolManager.selector);
        vault.unlockCallback("");
    }

    function test_LeftoverDelta_Reverts_NonZeroDelta() public {
        NoSettleVault broken = new NoSettleVault(fundOwner, manager, fundManager);
        deal(Currency.unwrap(currency0), address(broken), 1_000e18);

        // The receipt must name the broken vault, or MandatePolicy rejects it
        // as WrongVault before the router logic is ever reached.
        IPoolManager.SwapParams memory params = _sellParams(-1e15);
        bytes memory blob = _blobFor(address(broken), params, 0, VALIDATOR_PK);

        vm.prank(fundManager);
        vm.expectRevert(); // NonZeroDelta — the amounts depend on pool state
        broken.trade(poolKey, params, blob);
    }

    // --- emergencyExit is outside every policy, by design -----------------

    function test_EmergencyExit_OnlyOwner_Reverts_NotOwner() public {
        Currency[] memory cs = new Currency[](1);
        cs[0] = currency0;

        vm.prank(fundManager);
        vm.expectRevert(IndentureVault.NotOwner.selector);
        vault.emergencyExit(fundManager, cs);
    }

    function test_EmergencyExit_WorksDuringBreach() public {
        // The strongest form of "the fund is in trouble": the pool's policy is
        // gone, so no trade can execute at all. The exit path must still work —
        // a bricked or hostile policy must never be able to trap the fund.
        // There is no policy call anywhere on this path; that is the point.
        //
        // Sprint 2 adds the same assertion driven by a real MandatePolicy
        // breach, once inBreach() has covenant logic behind it.
        vm.prank(fundOwner);
        hook.setPolicy(poolId, IPolicy(address(0)));

        IPoolManager.SwapParams memory params = _sellParams(-1e15);
        bytes memory blob = _signedFor(params);
        vm.prank(fundManager);
        // PoolManager re-wraps a reverting hook in WrappedError, so the inner
        // NoPolicyForPool selector is not directly matchable here.
        vm.expectRevert();
        vault.trade(poolKey, params, blob);

        Currency[] memory cs = new Currency[](2);
        cs[0] = currency0;
        cs[1] = currency1;

        address safe = makeAddr("safeHarbour");
        uint256 held0 = _balOf(currency0, address(vault));
        uint256 held1 = _balOf(currency1, address(vault));

        vm.prank(fundOwner);
        vault.emergencyExit(safe, cs);

        assertEq(_balOf(currency0, safe), held0, "currency0 did not reach safety");
        assertEq(_balOf(currency1, safe), held1, "currency1 did not reach safety");
        assertEq(_balOf(currency0, address(vault)), 0, "vault still holds currency0");
        assertEq(_balOf(currency1, address(vault)), 0, "vault still holds currency1");
    }

    function _balOf(Currency c, address who) private view returns (uint256) {
        return IERC20Minimal(Currency.unwrap(c)).balanceOf(who);
    }
}
