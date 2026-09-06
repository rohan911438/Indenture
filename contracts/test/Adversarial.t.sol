// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IndentureTest} from "./utils/IndentureTest.sol";
import {MandatePolicy} from "../src/policies/MandatePolicy.sol";
import {IndentureVault} from "../src/IndentureVault.sol";
import {IPolicy} from "../src/interfaces/IPolicy.sol";
import {ReceiptLib} from "../src/libs/ReceiptLib.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolId} from "v4-core/types/PoolId.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {IERC20Minimal} from "v4-core/interfaces/external/IERC20Minimal.sol";

/// The pitch, as tests. A fully compromised Manager, or a forged or replayed
/// Validator signature, still cannot move funds outside the mandate.
///
/// Each scenario maps to one `npm run inject` attack, and each one is a thing
/// that would actually be tried — not a synthetic edge case.
contract AdversarialTest is IndentureTest {
    /// The Manager key is assumed stolen. `.env.example` calls its blast radius
    /// "low by design"; these tests are what makes that sentence true.
    function test_CompromisedManager_DrainToAttacker_Reverts() public {
        address attacker = makeAddr("attacker");

        // The stolen key can call `trade`. That is its entire authority — it
        // cannot move tokens, change the manager, or reach emergencyExit.
        vm.prank(fundManager);
        vm.expectRevert(IndentureVault.NotOwner.selector);
        vault.emergencyExit(attacker, new Currency[](0));

        vm.prank(fundManager);
        vm.expectRevert(IndentureVault.NotOwner.selector);
        vault.setManager(attacker);

        // And a trade it invents itself, with no Validator receipt, dies at the
        // signature check.
        IPoolManager.SwapParams memory params = _sellParams(-1e15);
        ReceiptLib.Receipt memory r = _receipt(params, 0);
        bytes memory selfSigned = _blob(r, ROGUE_PK);

        vm.prank(fundManager);
        vm.expectRevert();
        vault.trade(poolKey, params, selfSigned);

        assertEq(policy.seqOf(address(vault)), 0, "a refused attack must not consume a seq");
    }

    function test_ForgedReceipt_Reverts_BadSigner() public {
        IPoolManager.SwapParams memory params = _sellParams(-1e15);
        bytes memory forged = _blobFor(address(vault), params, 0, ROGUE_PK);

        vm.prank(address(hook));
        vm.expectRevert(abi.encodeWithSelector(MandatePolicy.BadSigner.selector, rogueSigner));
        policy.beforeSwap(address(vault), poolId, poolKey, params, forged);
    }

    function test_ReplayedReceipt_Reverts_StaleSeq() public {
        // Yesterday's receipt was genuine, signed by the real Validator, and
        // executed. Presenting it again must fail on the nonce alone.
        IPoolManager.SwapParams memory params = _sellParams(-1e15);
        bytes memory yesterday = _signedFor(params);
        _trade(params, yesterday);

        vm.prank(address(hook));
        vm.expectRevert(abi.encodeWithSelector(MandatePolicy.StaleSeq.selector, uint64(0), uint64(1)));
        policy.beforeSwap(address(vault), poolId, poolKey, params, yesterday);
    }

    /// The headline scenario. A prompt injection convinces the LLM Manager to
    /// propose an oversized trade, AND the Validator is compromised into signing
    /// it. The receipt is genuine by every check the signature layer can make.
    /// The size covenant refuses it anyway, on chain, with no oracle read.
    function test_PromptInjection_OversizePosition_Reverts_CovenantMaxPosition() public {
        vm.prank(fundOwner);
        policy.amend(MANDATE_HASH, MAX_POSITION_BPS, MIN_CASH_BPS, 1000, MAX_DAILY_NOTIONAL, QUOTE_IS_CURRENCY0);

        IPoolManager.SwapParams memory oversized = _sellParams(-1e15);
        bytes memory properlySigned = _signedFor(oversized);

        // Signature, deadline, vault, mandate, pool, seq and paramsHash all
        // pass — this is not a forgery.
        vm.prank(address(hook));
        assertEq(
            policy.beforeSwap(address(vault), poolId, poolKey, oversized, properlySigned),
            IPolicy.beforeSwap.selector,
            "the receipt is genuine; the test is meaningless if it is not"
        );

        // The trade still cannot execute.
        uint256 before = IERC20Minimal(Currency.unwrap(currency0)).balanceOf(address(vault));
        bytes memory fresh = _signedFor(oversized);
        vm.prank(fundManager);
        vm.expectRevert();
        vault.trade(poolKey, oversized, fresh);

        assertEq(
            IERC20Minimal(Currency.unwrap(currency0)).balanceOf(address(vault)),
            before,
            "not a single token may move"
        );
    }

    /// The weight covenant the hook cannot enforce is still made visible, and
    /// carries a consequence: the share class freezes.
    function test_PromptInjection_OversizePosition_IsJournaledAsBreach() public {
        vm.expectEmit(true, true, false, true, address(policy));
        emit MandatePolicy.BreachObserved(0, PoolId.unwrap(poolId), "maxPositionBps");

        vm.prank(address(vault));
        policy.observeSnapshot(1_000_000, 411_000, 200_000, PoolId.unwrap(poolId)); // 4110bps vs 3000

        assertTrue(policy.inBreach(), "a breach must freeze the share class");
    }

    function test_BrickedPolicy_EmergencyExitStillWorks() public {
        // A policy that reverts on everything — the worst case for a fund that
        // has delegated its rules to a contract.
        // Deploy first: `new` inside the argument would consume the prank.
        BrickedPolicy bricked = new BrickedPolicy();
        vm.prank(fundOwner);
        hook.setPolicy(poolId, IPolicy(address(bricked)));

        IPoolManager.SwapParams memory params = _sellParams(-1e15);
        bytes memory blob = _signedFor(params);
        vm.prank(fundManager);
        vm.expectRevert();
        vault.trade(poolKey, params, blob);

        // The owner can still recover the fund. emergencyExit touches no policy.
        Currency[] memory cs = new Currency[](2);
        cs[0] = currency0;
        cs[1] = currency1;
        address safe = makeAddr("safeHarbour");
        uint256 held = IERC20Minimal(Currency.unwrap(currency0)).balanceOf(address(vault));

        vm.prank(fundOwner);
        vault.emergencyExit(safe, cs);

        assertEq(IERC20Minimal(Currency.unwrap(currency0)).balanceOf(safe), held);
    }

    function test_ValidatorCannotBeSwappedByAnyoneButOwner() public {
        // The registered signer is the trust anchor. If the Manager could
        // rotate it, every other guarantee here is decorative.
        vm.prank(fundManager);
        vm.expectRevert(bytes("not owner"));
        policy.setValidatorSigner(rogueSigner);

        vm.prank(fundManager);
        vm.expectRevert(bytes("not owner"));
        policy.setVault(makeAddr("attackerVault"));
    }
}

/// @dev Reverts on every callback.
contract BrickedPolicy is IPolicy {
    error Bricked();

    function beforeSwap(address, PoolId, PoolKey calldata, IPoolManager.SwapParams calldata, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        revert Bricked();
    }

    function afterSwap(address, PoolId, PoolKey calldata, IPoolManager.SwapParams calldata, int128, int128)
        external
        pure
        returns (bytes4)
    {
        revert Bricked();
    }

    function inBreach() external pure returns (bool) {
        return true;
    }
}
