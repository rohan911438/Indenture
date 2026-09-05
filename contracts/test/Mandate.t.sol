// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";

/// Build step 7. Signature + binding FIRST, covenants SECOND.
contract MandateTest is Test {
    // --- signature + binding ---
    function test_ValidReceipt_FromRegisteredSigner_Passes() public {
        vm.skip(true);
    }

    function test_WrongSigner_Reverts_BadSigner() public {
        vm.skip(true);
    }

    function test_ExpiredReceipt_Reverts_ReceiptExpired() public {
        vm.skip(true);
    }

    function test_ReceiptForOtherVault_Reverts_WrongVault() public {
        vm.skip(true);
    }

    function test_TamperedParams_Reverts_ParamsMismatch() public {
        vm.skip(true);
    }

    function test_StaleMandateHash_Reverts_ParamsMismatch() public {
        vm.skip(true);
    }

    // --- 4 covenants ---
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

    // --- amend ---
    function test_Amend_OnlyOwner() public {
        vm.skip(true);
    }
}
