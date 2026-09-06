// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Deployments} from "./Deployments.sol";
import {console2} from "forge-std/Script.sol";
import {PoolManager} from "v4-core/PoolManager.sol";

/// STEP 1 of the build order and the single biggest unknown: get the
/// unmodified Uniswap v4-core PoolManager onto Hedera testnet with
/// evm_version=cancun / solc 0.8.26.
///
/// Deploy ONCE, pin in deployments.json, never redeploy — testnet HBAR is the
/// one scarce resource. This script refuses to run twice for that reason.
///
/// Measured size: 24,009 bytes runtime against Hedera's 24,576-byte EIP-170
/// limit. It fits with 567 bytes of margin, which is also why foundry.toml
/// pins optimizer_runs — see docs/RESEARCH.md section 3.
///
/// Run a gas estimate WITHOUT --broadcast first.
contract DeployPoolManager is Deployments {
    function run() external {
        address existing = _readAddr(".contracts.PoolManager");
        if (existing != address(0)) {
            console2.log("PoolManager already deployed at", existing);
            console2.log("Refusing to redeploy. Clear the field by hand if you really mean to.");
            return;
        }

        uint256 pk = _deployerKey();
        address owner = vm.addr(pk);

        vm.startBroadcast(pk);
        PoolManager pm = new PoolManager(owner);
        vm.stopBroadcast();

        _writeAddr(".contracts.PoolManager", address(pm));
    }
}
