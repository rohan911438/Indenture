// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IndentureTest} from "./utils/IndentureTest.sol";
import {MandatePolicy} from "../src/policies/MandatePolicy.sol";
import {IPolicy} from "../src/interfaces/IPolicy.sol";
import {ReceiptLib} from "../src/libs/ReceiptLib.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";

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
        policy.amend(newHash, MAX_POSITION_BPS, MIN_CASH_BPS, MAX_TRADE_NOTIONAL, MAX_DAILY_NOTIONAL);

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
        policy.amend(keccak256("hostile"), 9999, 0, type(uint256).max, type(uint256).max);

        uint64 seqBefore = policy.mandateSeq();
        vm.prank(fundOwner);
        policy.amend(keccak256("fund-one/v2"), 2000, 1500, 1, 2);

        assertEq(policy.mandateHash(), keccak256("fund-one/v2"));
        assertEq(policy.mandateSeq(), seqBefore + 1, "amend must bump the mandate seq");
        assertEq(policy.maxPositionBps(), 2000);
        assertEq(policy.minCashBps(), 1500);
        assertEq(policy.maxTradeNotional(), 1);
        assertEq(policy.maxDailyNotional(), 2);
    }

    // --- covenants: Sprint 2 ----------------------------------------------

    function test_Covenant_MaxPosition_Reverts() public {
        vm.skip(true);
    }

    function test_Covenant_MinCash_Reverts() public {
        vm.skip(true);
    }

    function test_Covenant_TradeNotional_Reverts() public {
        vm.skip(true);
    }

    function test_Covenant_DailyNotional_Reverts() public {
        vm.skip(true);
    }
}
