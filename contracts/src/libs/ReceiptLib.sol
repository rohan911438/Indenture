// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title  ReceiptLib
/// @notice The on-chain half of the receipt seam. The EIP-712 struct here MUST
///         be byte-identical to the TypeScript signer in `packages/receipt`.
///         `test_SignedInTypescript_RecoversInSolidity` is the guard, fed by
///         `packages/receipt/vectors/receipt-296.json`.
library ReceiptLib {
    /// @dev keccak256("Receipt(bytes32 mandateHash,bytes32 poolId,bytes32 paramsHash,uint64 seq,uint64 deadline,address vault)")
    bytes32 internal constant RECEIPT_TYPEHASH =
        0x655d4a89164a0a3ef420c14dfab8aa47861c14ec6997a6e54da5a326f0021583;

    /// @dev keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")
    bytes32 internal constant EIP712_DOMAIN_TYPEHASH =
        0x8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f;

    /// @dev keccak256("Indenture")
    bytes32 internal constant DOMAIN_NAME_HASH =
        0xdce2a127d9602b1abfb01bfd342f87dbb6faa5c26ff9291c73cab740ac609e14;

    /// @dev keccak256("1")
    bytes32 internal constant DOMAIN_VERSION_HASH =
        0xc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc6;

    /// @notice The EIP-712 domain separator for the Indenture receipt. Must
    ///         equal `receiptDomain()` in `packages/receipt/src/types.ts`.
    /// @param chainId            the signing chain id (296 on Hedera testnet)
    /// @param verifyingContract  the MandatePolicy address
    function domainSeparator(uint256 chainId, address verifyingContract) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH, DOMAIN_NAME_HASH, DOMAIN_VERSION_HASH, chainId, verifyingContract
            )
        );
    }

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
