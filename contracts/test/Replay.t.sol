// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IndentureTest} from "./utils/IndentureTest.sol";
import {MandatePolicy} from "../src/policies/MandatePolicy.sol";
import {IPolicy} from "../src/interfaces/IPolicy.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";

/// Anti-replay. The per-vault monotonic `seq` is the real boundary — the
/// Validator's KV lock is a courtesy that keeps the journal clean, but this is
/// what makes a stolen receipt worthless.
contract ReplayTest is IndentureTest {
    function test_SameReceiptTwice_Reverts_StaleSeq() public {
        IPoolManager.SwapParams memory params = _sellParams(-1e15);
        bytes memory blob = _signedFor(params);

        // First presentation consumes seq 0.
        _callPolicy(params, blob);
        assertEq(policy.seqOf(address(vault)), 1);

        // Replaying the identical, still-unexpired, correctly-signed receipt
        // must fail. Nothing about the receipt changed — only the chain state.
        vm.prank(address(hook));
        vm.expectRevert(abi.encodeWithSelector(MandatePolicy.StaleSeq.selector, uint64(0), uint64(1)));
        policy.beforeSwap(address(vault), poolId, poolKey, params, blob);
    }

    function test_ReplayThroughTheVault_Reverts() public {
        // The same property, end to end: a receipt that already produced a
        // swap cannot produce a second one.
        IPoolManager.SwapParams memory params = _sellParams(-1e15);
        bytes memory blob = _signedFor(params);

        _trade(params, blob);

        vm.prank(fundManager);
        vm.expectRevert(); // StaleSeq, wrapped by PoolManager
        vault.trade(poolKey, params, blob);
    }

    function test_SeqAdvancesMonotonically_PerVault() public {
        IPoolManager.SwapParams memory params = _sellParams(-1e15);

        for (uint64 i = 0; i < 3; i++) {
            assertEq(policy.seqOf(address(vault)), i, "seq out of step before trade");
            _callPolicy(params, _signedFor(params));
            assertEq(policy.seqOf(address(vault)), i + 1, "seq did not advance by exactly one");
        }

        // Sequences are per-vault, not global: a second fund starts at zero and
        // is unaffected by this vault's history.
        address otherVault = makeAddr("secondFund");
        assertEq(policy.seqOf(otherVault), 0, "a fresh vault must start at seq 0");

        bytes memory otherBlob = _blobFor(otherVault, params, 0, VALIDATOR_PK);
        vm.prank(address(hook));
        policy.beforeSwap(otherVault, poolId, poolKey, params, otherBlob);

        assertEq(policy.seqOf(otherVault), 1);
        assertEq(policy.seqOf(address(vault)), 3, "one vault's trade must not move another's seq");
    }

    function test_SeqCannotBeSkippedAhead() public {
        // Signing a future seq must not work either — otherwise a Validator
        // that signed seq 5 early would let seqs 0-4 be silently skipped.
        IPoolManager.SwapParams memory params = _sellParams(-1e15);
        bytes memory blob = _blobFor(address(vault), params, 5, VALIDATOR_PK);

        vm.prank(address(hook));
        vm.expectRevert(abi.encodeWithSelector(MandatePolicy.StaleSeq.selector, uint64(5), uint64(0)));
        policy.beforeSwap(address(vault), poolId, poolKey, params, blob);
    }

    function test_ReceiptFromDifferentChainId_Reverts() public {
        // Cross-chain replay: the same fund deployed on another network must
        // not accept a receipt signed for this one. chainId is inside the
        // EIP-712 domain, so a foreign-domain signature simply recovers to a
        // different address and fails the signer check.
        IPoolManager.SwapParams memory params = _sellParams(-1e15);
        bytes memory blob = _blobForeignDomain(params, 1); // signed for mainnet

        vm.prank(address(hook));
        vm.expectRevert(); // BadSigner(<some other address>)
        policy.beforeSwap(address(vault), poolId, poolKey, params, blob);

        assertEq(policy.seqOf(address(vault)), 0, "a rejected receipt must not consume a seq");
    }
}
