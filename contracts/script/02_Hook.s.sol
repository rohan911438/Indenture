// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";

/// STEP 4: deploy PolicyHook at a mined address whose low bits encode the
/// BEFORE_SWAP | AFTER_SWAP permission flags (Uniswap v4 requirement), then
/// deploy CompliancePolicy and register it for the fund's PoolId.
///
/// Uses HookMiner (v4-periphery) + CREATE2 to find the salt.
contract DeployHook is Script {
    function run() external {
        uint256 pk = vm.envUint("HEDERA_OPERATOR_KEY");
        vm.startBroadcast(pk);

        // uint160 flags = uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG);
        // (address hookAddr, bytes32 salt) =
        //     HookMiner.find(CREATE2_DEPLOYER, flags, type(PolicyHook).creationCode, abi.encode(owner));
        // PolicyHook hook = new PolicyHook{salt: salt}(owner);
        // require(address(hook) == hookAddr, "hook address mismatch");

        vm.stopBroadcast();
        console2.log("STUB: mine hook address, deploy PolicyHook + CompliancePolicy, persist");
    }
}
