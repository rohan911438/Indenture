// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title  ReceiptLib
/// @notice The on-chain half of the receipt seam. The EIP-712 struct here MUST
///         be byte-identical to the TypeScript signer in `packages/receipt`.
///         `test_SignedInTypescript_RecoversInSolidity` is the guard.
/// @dev    STUB - fill in alongside packages/receipt on build step 3.
library ReceiptLib {
    /// @dev keccak256("Receipt(bytes32 mandateHash,bytes32 poolId,bytes32 paramsHash,uint64 seq,uint64 deadline,address vault)")
    bytes32 internal constant RECEIPT_TYPEHASH =
        0x0000000000000000000000000000000000000000000000000000000000000000; // TODO: compute

    struct Receipt {
        bytes32 mandateHash; // canonical hash of the compiled mandate YAML
        bytes32 poolId; // the v4 PoolId the swap targets
        bytes32 paramsHash; // keccak256(abi.encode(SwapParams)) - binds exact trade
        uint64 seq; // monotonic per-vault nonce - anti-replay
        uint64 deadline; // unix seconds; Validator's staleness judgement, enforced on-chain
        address vault; // the IndentureVault this receipt authorises
    }

    function hashStruct(Receipt memory r) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(RECEIPT_TYPEHASH, r.mandateHash, r.poolId, r.paramsHash, r.seq, r.deadline, r.vault)
        );
    }

    /// @notice EIP-712 digest given a domain separator.
    function digest(bytes32 domainSeparator, Receipt memory r) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, hashStruct(r)));
    }
}
