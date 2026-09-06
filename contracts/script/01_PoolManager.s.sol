// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";

/// STEP 1 of the build order and the single biggest unknown: get the
/// unmodified Uniswap v4-core PoolManager onto Hedera testnet with
/// evm_version=cancun / solc 0.8.26. Deploy ONCE, pin in deployments.json,
/// never redeploy (testnet HBAR is the one scarce resource).
///
/// Run a gas estimate WITHOUT --broadcast first.
contract DeployPoolManager is Script {
    function run() external {
        uint256 pk = vm.envUint("HEDERA_OPERATOR_KEY");
        vm.startBroadcast(pk);

        // import {PoolManager} from "v4-core/PoolManager.sol";
        // PoolManager pm = new PoolManager(msg.sender);
        // console2.log("PoolManager:", address(pm));

        vm.stopBroadcast();

        // TODO: write address into deployments.json via vm.writeJson(...)
        console2.log("STUB: wire in v4-core PoolManager, then persist to deployments.json");
    }
}
