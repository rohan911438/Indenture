// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Deployments} from "./Deployments.sol";
import {console2} from "forge-std/Script.sol";
import {HookMiner} from "../src/libs/HookMiner.sol";
import {PolicyHook} from "../src/PolicyHook.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";

/// STEP 4: deploy PolicyHook at a mined address whose low 14 bits encode
/// exactly BEFORE_SWAP | AFTER_SWAP (0xC0). Uniswap v4 reads a hook's
/// permissions out of its address, so this cannot be deployed anywhere
/// convenient — the salt has to be ground for.
///
/// CREATE2 is available on Hedera via HIP-329 and derives the EIP-1014 address
/// exactly as on any other EVM chain, so no Hedera-specific path is needed.
/// `Hook.t.sol` proves the miner agrees with what PoolManager will accept
/// before this script spends anything.
contract DeployHook is Deployments {
    /// Foundry routes salted deployments through this deterministic deployer
    /// under --broadcast, so this — not the script address — is what to mine
    /// against. Getting this wrong is a failed deployment; see Hook.t.sol.
    address internal constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    function run() external {
        address poolManager = _requireAddr(".contracts.PoolManager");

        address existing = _readDeployed(".contracts.PolicyHook");
        if (existing != address(0)) {
            console2.log("PolicyHook already deployed at", existing);
            return;
        }

        uint256 pk = _deployerKey();
        address owner = vm.addr(pk);

        uint160 flags = uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG);
        (address predicted, bytes32 salt) = HookMiner.find(
            CREATE2_DEPLOYER, flags, type(PolicyHook).creationCode, abi.encode(poolManager, owner)
        );
        console2.log("mined hook address", predicted);

        vm.startBroadcast(pk);
        PolicyHook hook = new PolicyHook{salt: salt}(IPoolManager(poolManager), owner);
        vm.stopBroadcast();

        require(address(hook) == predicted, "hook landed at an unmined address");

        _writeAddr(".contracts.PolicyHook", address(hook));
    }
}
