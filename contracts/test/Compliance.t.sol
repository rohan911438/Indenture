// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";

/// Build step 4. The headline scenario: a verified wallet buys, an unverified
/// one is refused. One test per named revert error.
contract ComplianceTest is Test {
    function test_VerifiedWallet_CanSwap() public {
        vm.skip(true);
    }

    function test_UnverifiedWallet_Reverts_NotVerified() public {
        vm.skip(true);
    }

    function test_NonCompliantTransfer_Reverts_TransferNotCompliant() public {
        vm.skip(true);
    }

    function test_UnregisteredPool_Reverts_NoPolicyForPool() public {
        vm.skip(true);
    }
}
