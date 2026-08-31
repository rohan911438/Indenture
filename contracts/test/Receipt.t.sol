// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ReceiptLib} from "../src/libs/ReceiptLib.sol";

/// THE critical seam test (build step 3). A vector signed by the TypeScript
/// signer in `packages/receipt` must recover to the same address here.
///
/// Vector source: packages/receipt/vectors/receipt-296.json
/// Regenerate with: npm run vector -w @indenture/receipt
contract ReceiptTest is Test {
    // --- pasted from packages/receipt/vectors/receipt-296.json ---
    uint256 constant CHAIN_ID = 296;
    address constant VERIFYING_CONTRACT = 0x00000000000000000000000000000000000000A4;
    address constant EXPECTED_SIGNER = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266; // anvil #0

    bytes32 constant EXPECTED_DOMAIN_SEPARATOR =
        0x51260f28ba3d25ab2e2391a367a99cdf2371248cb7de11d4eb5e5e932dcb7b30;
    bytes32 constant EXPECTED_DIGEST = 0x97992931095e82b1d659283b756d6fe31fdb216d24d7efc5cfb9fa07b24941bc;
    bytes constant SIG =
        hex"b30a492fe5f8fbbfbf1954cffc70e0df2c22c89f9acfc2a20103e64303c4b73a314a96e4661bddbee68d8ebf1aa4622c1cab4b6ff74981ff14d927cf32c77b251c";

    function _vector() internal pure returns (ReceiptLib.Receipt memory r) {
        r = ReceiptLib.Receipt({
            mandateHash: 0x1111111111111111111111111111111111111111111111111111111111111111,
            poolId: 0x2222222222222222222222222222222222222222222222222222222222222222,
            paramsHash: 0x3333333333333333333333333333333333333333333333333333333333333333,
            seq: 0,
            deadline: 4102444800,
            vault: 0x00000000000000000000000000000000000000B0
        });
    }

    function test_TypehashMatchesSpec() public pure {
        assertEq(
            ReceiptLib.RECEIPT_TYPEHASH,
            keccak256(
                "Receipt(bytes32 mandateHash,bytes32 poolId,bytes32 paramsHash,uint64 seq,uint64 deadline,address vault)"
            )
        );
    }

    function test_DomainSeparatorMatchesTypescript() public pure {
        assertEq(ReceiptLib.domainSeparator(CHAIN_ID, VERIFYING_CONTRACT), EXPECTED_DOMAIN_SEPARATOR);
    }

    function test_DigestMatchesTypescript() public pure {
        bytes32 ds = ReceiptLib.domainSeparator(CHAIN_ID, VERIFYING_CONTRACT);
        assertEq(ReceiptLib.digest(ds, _vector()), EXPECTED_DIGEST);
    }

    function test_SignedInTypescript_RecoversInSolidity() public pure {
        bytes32 ds = ReceiptLib.domainSeparator(CHAIN_ID, VERIFYING_CONTRACT);
        bytes32 digest = ReceiptLib.digest(ds, _vector());
        address recovered = ECDSA.recover(digest, SIG);
        assertEq(recovered, EXPECTED_SIGNER);
    }

    function test_TamperedFieldBreaksRecovery() public pure {
        bytes32 ds = ReceiptLib.domainSeparator(CHAIN_ID, VERIFYING_CONTRACT);
        ReceiptLib.Receipt memory r = _vector();
        r.seq = 1; // tamper
        address recovered = ECDSA.recover(ReceiptLib.digest(ds, r), SIG);
        assertTrue(recovered != EXPECTED_SIGNER);
    }
}
