// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ReceiptLib} from "../src/libs/ReceiptLib.sol";

/// THE critical seam test - write this FIRST (build step 3), before anything
/// depends on the receipt format. A vector signed by the TypeScript signer in
/// `packages/receipt` must recover to the same address here.
contract ReceiptTest is Test {
    /// @dev vector produced by `npm run vector -w @indenture/receipt`
    function test_SignedInTypescript_RecoversInSolidity() public {
        vm.skip(true); // TODO: paste TS-generated (receipt, signature, expectedSigner, domainSeparator)
        // ReceiptLib.Receipt memory r = ReceiptLib.Receipt({...});
        // bytes32 digest = ReceiptLib.digest(DOMAIN_SEPARATOR, r);
        // address recovered = ECDSA.recover(digest, SIG);
        // assertEq(recovered, EXPECTED_SIGNER);
    }

    function test_TypehashMatchesSpec() public {
        vm.skip(true); // TODO: compute RECEIPT_TYPEHASH in ReceiptLib, then drop this skip
        assertEq(
            ReceiptLib.RECEIPT_TYPEHASH,
            keccak256(
                "Receipt(bytes32 mandateHash,bytes32 poolId,bytes32 paramsHash,uint64 seq,uint64 deadline,address vault)"
            )
        );
    }
}
