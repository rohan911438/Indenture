// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";

/// Build step 10. The pitch: a fully compromised Manager, or a forged/replayed
/// Validator signature, still cannot move funds outside the mandate - and the
/// refusal is journaled. Each scenario maps to one `npm run inject` attack.
contract AdversarialTest is Test {
    /// Manager key stolen; attacker proposes a drain to their own address.
    function test_CompromisedManager_DrainToAttacker_Reverts() public {
        vm.skip(true);
    }

    /// Attacker forges a receipt with a self-signed key.
    function test_ForgedReceipt_Reverts_BadSigner() public {
        vm.skip(true);
    }

    /// Attacker replays yesterday's legitimately-signed receipt.
    function test_ReplayedReceipt_Reverts_StaleSeq() public {
        vm.skip(true);
    }

    /// Prompt injection pushes an oversized position past the covenant.
    function test_PromptInjection_OversizePosition_Reverts_CovenantMaxPosition() public {
        vm.skip(true);
    }

    /// Even if MandatePolicy is bricked, owner can still emergencyExit.
    function test_BrickedPolicy_EmergencyExitStillWorks() public {
        vm.skip(true);
    }
}
