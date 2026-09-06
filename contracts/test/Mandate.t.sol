// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IndentureTest} from "./utils/IndentureTest.sol";
import {MandatePolicy} from "../src/policies/MandatePolicy.sol";
import {IPolicy} from "../src/interfaces/IPolicy.sol";
import {ReceiptLib} from "../src/libs/ReceiptLib.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolId} from "v4-core/types/PoolId.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {IERC20Minimal} from "v4-core/interfaces/external/IERC20Minimal.sol";

/// Signature + binding FIRST, covenants SECOND.
///
/// These call MandatePolicy the way PolicyHook does, so each named revert is
/// asserted exactly. The end-to-end path through PoolManager is covered by
/// Router.t.sol.
contract MandateTest is IndentureTest {
    // --- signature ---------------------------------------------------------

    function test_ValidReceipt_FromRegisteredSigner_Passes() public {
        IPoolManager.SwapParams memory params = _sellParams(-1e15);
        // Build the blob first: _signedFor reads policy state, and those calls
        // would consume the prank before beforeSwap is reached.
        bytes memory blob = _signedFor(params);

        vm.prank(address(hook));
        bytes4 sel = policy.beforeSwap(address(vault), poolId, poolKey, params, blob);

        assertEq(sel, IPolicy.beforeSwap.selector, "policy did not return the accept selector");
        assertEq(policy.seqOf(address(vault)), 1, "seq did not advance on acceptance");
    }

    function test_WrongSigner_Reverts_BadSigner() public {
        IPoolManager.SwapParams memory params = _sellParams(-1e15);
        bytes memory blob = _blobFor(address(vault), params, 0, ROGUE_PK);

        vm.prank(address(hook));
        vm.expectRevert(abi.encodeWithSelector(MandatePolicy.BadSigner.selector, rogueSigner));
        policy.beforeSwap(address(vault), poolId, poolKey, params, blob);
    }

    function test_CallerMustBePolicyHook_Reverts_NotPolicyHook() public {
        // A receipt is a bearer token for one trade. If anyone could present it
        // to the policy directly they could burn the vault's sequence number
        // without a swap ever happening.
        IPoolManager.SwapParams memory params = _sellParams(-1e15);
        bytes memory blob = _signedFor(params);

        vm.prank(fundManager);
        vm.expectRevert(MandatePolicy.NotPolicyHook.selector);
        policy.beforeSwap(address(vault), poolId, poolKey, params, blob);
    }

    // --- binding -----------------------------------------------------------

    function test_ExpiredReceipt_Reverts_ReceiptExpired() public {
        IPoolManager.SwapParams memory params = _sellParams(-1e15);
        bytes memory blob = _signedFor(params);
        uint64 deadline = uint64(block.timestamp + 120);

        vm.warp(block.timestamp + 121);

        vm.prank(address(hook));
        vm.expectRevert(abi.encodeWithSelector(MandatePolicy.ReceiptExpired.selector, deadline));
        policy.beforeSwap(address(vault), poolId, poolKey, params, blob);
    }

    function test_ReceiptForOtherVault_Reverts_WrongVault() public {
        IPoolManager.SwapParams memory params = _sellParams(-1e15);
        address otherVault = makeAddr("someoneElsesFund");
        bytes memory blob = _blobFor(otherVault, params, 0, VALIDATOR_PK);

        vm.prank(address(hook));
        vm.expectRevert(abi.encodeWithSelector(MandatePolicy.WrongVault.selector, otherVault));
        policy.beforeSwap(address(vault), poolId, poolKey, params, blob);
    }

    function test_TamperedParams_Reverts_ParamsMismatch() public {
        // The receipt authorises a 1e15 sell; the Manager submits 500e18.
        // This is the core anti-tamper property: the signature covers the
        // exact trade, so swapping the params in transit cannot work.
        IPoolManager.SwapParams memory authorised = _sellParams(-1e15);
        IPoolManager.SwapParams memory submitted = _sellParams(-500e18);
        bytes memory blob = _signedFor(authorised);

        vm.prank(address(hook));
        vm.expectRevert(
            abi.encodeWithSelector(
                MandatePolicy.ParamsMismatch.selector,
                keccak256(abi.encode(submitted)),
                keccak256(abi.encode(authorised))
            )
        );
        policy.beforeSwap(address(vault), poolId, poolKey, submitted, blob);
    }

    /// @dev Renamed from `test_StaleMandateHash_Reverts_ParamsMismatch`: a
    ///      stale mandate hash now has its own `StaleMandate` error rather than
    ///      being folded into `ParamsMismatch`, so the two failures are
    ///      distinguishable in the journal.
    function test_StaleMandateHash_Reverts_StaleMandate() public {
        IPoolManager.SwapParams memory params = _sellParams(-1e15);
        bytes memory blob = _signedFor(params); // signed against the current mandate

        // The owner amends the mandate after the Validator signed. The
        // in-flight receipt must no longer be accepted.
        bytes32 newHash = keccak256("fund-one/v2");
        vm.prank(fundOwner);
        policy.amend(newHash, MAX_POSITION_BPS, MIN_CASH_BPS, MAX_TRADE_NOTIONAL, MAX_DAILY_NOTIONAL, QUOTE_IS_CURRENCY0);

        vm.prank(address(hook));
        vm.expectRevert(abi.encodeWithSelector(MandatePolicy.StaleMandate.selector, MANDATE_HASH, newHash));
        policy.beforeSwap(address(vault), poolId, poolKey, params, blob);
    }

    function test_ReceiptForOtherPool_Reverts_WrongPool() public {
        IPoolManager.SwapParams memory params = _sellParams(-1e15);
        ReceiptLib.Receipt memory r = _receipt(params, 0);
        r.poolId = keccak256("some other pool");
        bytes memory blob = _blob(r, VALIDATOR_PK);

        vm.prank(address(hook));
        vm.expectRevert(abi.encodeWithSelector(MandatePolicy.WrongPool.selector, r.poolId));
        policy.beforeSwap(address(vault), poolId, poolKey, params, blob);
    }

    // --- amend -------------------------------------------------------------

    function test_Amend_OnlyOwner() public {
        vm.prank(fundManager);
        vm.expectRevert(bytes("not owner"));
        policy.amend(keccak256("hostile"), 9999, 0, type(uint256).max, type(uint256).max, false);

        uint64 seqBefore = policy.mandateSeq();
        vm.prank(fundOwner);
        policy.amend(keccak256("fund-one/v2"), 2000, 1500, 1, 2, true);

        assertEq(policy.mandateHash(), keccak256("fund-one/v2"));
        assertEq(policy.mandateSeq(), seqBefore + 1, "amend must bump the mandate seq");
        assertEq(policy.maxPositionBps(), 2000);
        assertEq(policy.minCashBps(), 1500);
        assertEq(policy.maxTradeNotional(), 1);
        assertEq(policy.maxDailyNotional(), 2);
    }

    // --- covenants ---------------------------------------------------------
    //
    // The two size covenants are enforced in afterSwap against the ACTUAL
    // settled quote delta, so they hold with no price, no balance read and no
    // external call — which is what makes them survive a compromised Validator.
    // These tests sign every receipt with the REGISTERED validator key on
    // purpose: the point is that a perfectly valid signature is not enough.

    function test_Covenant_TradeNotional_Reverts() public {
        // Tighten the per-trade cap to below what this swap will move.
        vm.prank(fundOwner);
        policy.amend(MANDATE_HASH, MAX_POSITION_BPS, MIN_CASH_BPS, 1000, MAX_DAILY_NOTIONAL, QUOTE_IS_CURRENCY0);

        IPoolManager.SwapParams memory params = _sellParams(-1e15);
        bytes memory blob = _signedFor(params);

        vm.prank(fundManager);
        vm.expectRevert(); // CovenantTradeNotional, wrapped by PoolManager
        vault.trade(poolKey, params, blob);
    }

    function test_Covenant_TradeNotional_HoldsAgainstAValidSignature() public {
        // Spelled out because it is the headline claim: the receipt below is
        // signed by the registered Validator and passes every binding check.
        // The trade is still refused, on size alone, on chain.
        vm.prank(fundOwner);
        policy.amend(MANDATE_HASH, MAX_POSITION_BPS, MIN_CASH_BPS, 1000, MAX_DAILY_NOTIONAL, QUOTE_IS_CURRENCY0);

        IPoolManager.SwapParams memory params = _sellParams(-1e15);
        bytes memory blob = _signedFor(params);

        // The signature genuinely is good: the policy accepts it in isolation.
        vm.prank(address(hook));
        assertEq(
            policy.beforeSwap(address(vault), poolId, poolKey, params, blob),
            IPolicy.beforeSwap.selector,
            "the receipt should pass signature and binding"
        );

        // ...and the swap still cannot happen.
        bytes memory blob2 = _signedFor(params);
        vm.prank(fundManager);
        vm.expectRevert();
        vault.trade(poolKey, params, blob2);
    }

    function test_Covenant_DailyNotional_Reverts() public {
        // Cap the day just above one trade, then make two.
        uint256 firstNotional = _notionalOf(_sellParams(-1e15));

        vm.prank(fundOwner);
        policy.amend(
            MANDATE_HASH, MAX_POSITION_BPS, MIN_CASH_BPS, MAX_TRADE_NOTIONAL, firstNotional + 1, QUOTE_IS_CURRENCY0
        );

        IPoolManager.SwapParams memory params = _sellParams(-1e15);
        _trade(params, _signedFor(params));
        assertEq(policy.dailyNotional(), firstNotional, "first trade should have been recorded");

        bytes memory blob = _signedFor(params);
        vm.prank(fundManager);
        vm.expectRevert(); // CovenantDailyNotional
        vault.trade(poolKey, params, blob);
    }

    function test_Covenant_DailyNotional_ResetsAcrossTheDayBoundary() public {
        uint256 firstNotional = _notionalOf(_sellParams(-1e15));

        vm.prank(fundOwner);
        policy.amend(
            MANDATE_HASH, MAX_POSITION_BPS, MIN_CASH_BPS, MAX_TRADE_NOTIONAL, firstNotional + 1, QUOTE_IS_CURRENCY0
        );

        IPoolManager.SwapParams memory params = _sellParams(-1e15);
        _trade(params, _signedFor(params));

        // A day later the same trade is allowed again, and the running total
        // reflects only the new day.
        vm.warp(block.timestamp + 1 days);
        _trade(params, _signedFor(params));

        assertLe(policy.dailyNotional(), firstNotional + 1, "the day bucket did not roll over");
    }

    // --- weight covenants: observed, not prevented -------------------------
    //
    // maxPositionBps and minCashBps are weights against NAV, which needs
    // prices. Design rule 4 forbids the hook from reading an oracle, so these
    // are enforced off-chain by the Validator and observed on-chain here.

    function test_Covenant_MaxPosition_Reverts() public {
        // 3500bps against a 3000bps cap.
        vm.expectEmit(true, true, false, true, address(policy));
        emit MandatePolicy.BreachObserved(0, PoolId.unwrap(poolId), "maxPositionBps");

        vm.prank(address(vault));
        policy.observeSnapshot(1_000_000, 350_000, 200_000, PoolId.unwrap(poolId));

        assertTrue(policy.inBreach(), "an out-of-bounds position must freeze the share class");
    }

    function test_Covenant_MinCash_Reverts() public {
        // 500bps cash against a 1000bps floor.
        vm.expectEmit(true, true, false, true, address(policy));
        emit MandatePolicy.BreachObserved(0, PoolId.unwrap(poolId), "minCashBps");

        vm.prank(address(vault));
        policy.observeSnapshot(1_000_000, 100_000, 50_000, PoolId.unwrap(poolId));

        assertTrue(policy.inBreach());
    }

    function test_HealthySnapshot_ClearsBreach() public {
        vm.prank(address(vault));
        policy.observeSnapshot(1_000_000, 350_000, 200_000, PoolId.unwrap(poolId));
        assertTrue(policy.inBreach());

        // A later in-bounds snapshot must lift the freeze, or one bad tick
        // would brick the share class permanently.
        vm.prank(address(vault));
        policy.observeSnapshot(1_000_000, 250_000, 200_000, PoolId.unwrap(poolId));
        assertFalse(policy.inBreach());
    }

    function test_ObserveSnapshot_OnlyTheRegisteredVault() public {
        vm.prank(fundManager);
        vm.expectRevert(abi.encodeWithSelector(MandatePolicy.NotTheVault.selector, fundManager));
        policy.observeSnapshot(1_000_000, 100_000, 500_000, PoolId.unwrap(poolId));
    }

    // The tests above go through PoolManager, which wraps the revert and hides
    // the selector. These call afterSwap the way PolicyHook does, so the exact
    // covenant error is asserted — otherwise a bare expectRevert() would pass
    // on any failure at all, including an unrelated one.

    function test_TradeNotional_ExactError() public {
        vm.prank(fundOwner);
        policy.amend(MANDATE_HASH, MAX_POSITION_BPS, MIN_CASH_BPS, 1000, MAX_DAILY_NOTIONAL, QUOTE_IS_CURRENCY0);

        vm.prank(address(hook));
        vm.expectRevert(abi.encodeWithSelector(MandatePolicy.CovenantTradeNotional.selector, uint256(5000), uint256(1000)));
        // quote is currency1, so amount1 carries the notional
        policy.afterSwap(address(vault), poolId, poolKey, _sellParams(-1), int128(0), int128(5000));
    }

    function test_DailyNotional_ExactError() public {
        vm.prank(fundOwner);
        policy.amend(MANDATE_HASH, MAX_POSITION_BPS, MIN_CASH_BPS, 10_000, 1500, QUOTE_IS_CURRENCY0);

        // First fill: 1000, under both caps.
        vm.prank(address(hook));
        policy.afterSwap(address(vault), poolId, poolKey, _sellParams(-1), int128(0), int128(1000));
        assertEq(policy.dailyNotional(), 1000);

        // Second fill of 1000 is fine per-trade but takes the day to 2000.
        vm.prank(address(hook));
        vm.expectRevert(abi.encodeWithSelector(MandatePolicy.CovenantDailyNotional.selector, uint256(2000), uint256(1500)));
        policy.afterSwap(address(vault), poolId, poolKey, _sellParams(-1), int128(0), int128(1000));
    }

    function test_NotionalIsDirectionAgnostic() public {
        // A negative quote delta (the vault paying) counts the same as a
        // positive one (the vault receiving). Otherwise the cap would only
        // bind in one direction, which is exactly the hole an attacker uses.
        vm.prank(fundOwner);
        policy.amend(MANDATE_HASH, MAX_POSITION_BPS, MIN_CASH_BPS, 1000, MAX_DAILY_NOTIONAL, QUOTE_IS_CURRENCY0);

        vm.prank(address(hook));
        vm.expectRevert(abi.encodeWithSelector(MandatePolicy.CovenantTradeNotional.selector, uint256(5000), uint256(1000)));
        policy.afterSwap(address(vault), poolId, poolKey, _buyParams(1), int128(0), int128(-5000));
    }

    function test_AfterSwap_OnlyPolicyHook() public {
        vm.prank(fundManager);
        vm.expectRevert(MandatePolicy.NotPolicyHook.selector);
        policy.afterSwap(address(vault), poolId, poolKey, _sellParams(-1), int128(0), int128(1));
    }

    /// @dev How much quote currency a trade actually moves — run it against a
    ///      snapshot of state and roll back, so the caller's expectations are
    ///      built from the same arithmetic afterSwap will see.
    function _notionalOf(IPoolManager.SwapParams memory params) private returns (uint256) {
        uint256 snap = vm.snapshotState();
        uint256 before = _quoteBalance();
        _trade(params, _signedFor(params));
        uint256 moved = _quoteBalance() - before;
        vm.revertToState(snap);
        return moved;
    }

    function _quoteBalance() private view returns (uint256) {
        return IERC20Minimal(
            Currency.unwrap(QUOTE_IS_CURRENCY0 ? currency0 : currency1)
        ).balanceOf(address(vault));
    }
}
