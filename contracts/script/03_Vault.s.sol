// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";

/// STEP 5: deploy IndentureVault (its own v4 router), pointed at the pinned
/// PoolManager and the Manager key. Also deploys MandatePolicy (step 7) and
/// MockUSDC for the pool's quote currency.
contract DeployVault is Script {
    function run() external {
        uint256 pk = vm.envUint("HEDERA_OPERATOR_KEY");
        vm.startBroadcast(pk);

        // MockUSDC usdc = new MockUSDC();
        // IndentureVault vault = new IndentureVault(owner, poolManager, manager);
        // MandatePolicy mandate = new MandatePolicy(owner, validatorSigner, domainSeparator);

        vm.stopBroadcast();
        console2.log("STUB: deploy vault + MandatePolicy + MockUSDC, persist to deployments.json");
    }
}
