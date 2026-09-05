// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IPolicy} from "./interfaces/IPolicy.sol";

// NOTE: once `forge install` has vendored v4-periphery, switch the base to:
//   import {BaseHook} from "v4-periphery/utils/BaseHook.sol";
//   import {Hooks} from "v4-core/libraries/Hooks.sol";
//   import {PoolKey} from "v4-core/types/PoolKey.sol";
//   import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
// and mine a hook address with the BEFORE_SWAP | AFTER_SWAP flag bits set
// (see script/02_Hook.s.sol + HookMiner).

/// @title  PolicyHook
/// @notice A Uniswap v4 BaseHook that owns nothing but a routing table:
///         `mapping(PoolId => IPolicy)`. Every hook callback is delegated to
///         the policy registered for that pool. Adding a new fund == deploying
///         a new IPolicy and calling `setPolicy`, with no hook redeploy.
/// @dev    STUB - build step 4. Zero external calls beyond the delegate.
contract PolicyHook {
    address public owner;

    /// @dev keyed by PoolId (bytes32). Using bytes32 keeps the stub v4-free.
    mapping(bytes32 => IPolicy) public policyOf;

    error NotOwner();
    error NoPolicyForPool(bytes32 poolId);
    error PolicyRejected(bytes32 poolId);

    event PolicySet(bytes32 indexed poolId, address indexed policy);

    constructor(address _owner) {
        owner = _owner;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function setPolicy(bytes32 poolId, IPolicy policy) external onlyOwner {
        policyOf[poolId] = policy;
        emit PolicySet(poolId, address(policy));
    }

    // --- v4 hook callbacks (signatures finalised when BaseHook is wired in) ---

    function _beforeSwap(bytes32 poolId, address sender, bytes calldata key, bytes calldata params, bytes calldata hookData)
        internal
        returns (bytes4)
    {
        IPolicy p = policyOf[poolId];
        if (address(p) == address(0)) revert NoPolicyForPool(poolId);
        return p.beforeSwap(sender, key, params, hookData);
    }
}
