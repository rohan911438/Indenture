// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";

/// Final wiring pass (no new deploys):
///   - PolicyHook.setPolicy(poolId, MandatePolicy)      (or CompliancePolicy)
///   - MandatePolicy.setValidatorSigner(deployments.signers.validator)
///   - MandatePolicy.amend(mandateHash, covenant params from mandates/fund-one.yaml)
///   - PoolManager.initialize(poolKey, sqrtPriceX96)
///   - register MandateComplianceModule on the ATS ModularCompliance
contract Wire is Script {
    function run() external {
        uint256 pk = vm.envUint("HEDERA_OPERATOR_KEY");
        vm.startBroadcast(pk);
        vm.stopBroadcast();
        console2.log("STUB: read deployments.json, register policy + signer + covenants + pool");
    }
}
