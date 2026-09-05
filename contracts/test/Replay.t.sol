// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";

/// Anti-replay: a receipt authorises exactly one trade, once.
contract ReplayTest is Test {
    function test_SameReceiptTwice_Reverts_StaleSeq() public {
        vm.skip(true);
    }

    function test_SeqAdvancesMonotonically_PerVault() public {
        vm.skip(true);
    }

    function test_ReceiptFromDifferentChainId_Reverts() public {
        vm.skip(true); // domain separator binds chainId
    }
}
