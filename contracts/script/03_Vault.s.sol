// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Deployments} from "./Deployments.sol";
import {console2} from "forge-std/Script.sol";
import {IndentureVault} from "../src/IndentureVault.sol";
import {MandatePolicy} from "../src/policies/MandatePolicy.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {MockAsset} from "../src/mocks/MockAsset.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";

/// STEP 5: deploy the fund itself — IndentureVault (its own v4 router) pointed
/// at the pinned PoolManager, plus MandatePolicy and the two pool currencies.
///
/// MandatePolicy needs the PolicyHook address at construction (only the hook
/// may invoke its callbacks), which is why this runs after 02.
contract DeployVault is Deployments {
    function run() external {
        address poolManager = _requireAddr(".contracts.PoolManager");
        address policyHook = _requireAddr(".contracts.PolicyHook");

        uint256 pk = _deployerKey();
        address owner = vm.addr(pk);
        address managerAddr = vm.envAddress("MANAGER_ADDRESS");
        address validatorSigner = vm.envAddress("VALIDATOR_ADDRESS");

        vm.startBroadcast(pk);

        MockUSDC usdc = new MockUSDC();
        MockAsset asset = new MockAsset();

        IndentureVault vault = new IndentureVault(owner, IPoolManager(poolManager), managerAddr);

        // The EIP-712 domain separator is computed inside the constructor over
        // address(this), so there is no way for this script to bind receipts to
        // the wrong verifying contract.
        MandatePolicy policy = new MandatePolicy(owner, policyHook, validatorSigner);
        policy.setVault(address(vault));

        // Seed the fund so it can actually trade.
        usdc.mint(address(vault), 1_000_000e6);
        asset.mint(address(vault), 1_000_000e18);

        vm.stopBroadcast();

        _writeAddr(".contracts.MockUSDC", address(usdc));
        _writeAddr(".contracts.MockAsset", address(asset));
        _writeAddr(".contracts.IndentureVault", address(vault));
        _writeAddr(".contracts.MandatePolicy", address(policy));
        _writeAddr(".signers.validator", validatorSigner);
        _writeAddr(".signers.manager", managerAddr);
    }
}
