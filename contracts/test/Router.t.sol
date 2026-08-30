// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";

/// Build step 5. The vault-as-router: every branch must settle to zero deltas.
/// Run entirely on anvil.
contract RouterTest is Test {
    function test_Trade_SettlesToZeroDeltas() public {
        vm.skip(true);
    }

    function test_UnlockCallback_OnlyPoolManager_Reverts_NotPoolManager() public {
        vm.skip(true);
    }

    function test_Trade_OnlyManager_Reverts_NotManager() public {
        vm.skip(true);
    }

    function test_EmergencyExit_OnlyOwner_Reverts_NotOwner() public {
        vm.skip(true);
    }

    function test_EmergencyExit_WorksDuringBreach() public {
        vm.skip(true); // must NOT be gated by any policy
    }

    function test_LeftoverDelta_Reverts_NonZeroDelta() public {
        vm.skip(true);
    }
}
