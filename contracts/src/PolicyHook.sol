// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "./base/BaseHook.sol";
import {IPolicy} from "./interfaces/IPolicy.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "v4-core/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/types/BeforeSwapDelta.sol";

/// @title  PolicyHook
/// @notice A Uniswap v4 hook that owns nothing but a routing table:
///         `mapping(PoolId => IPolicy)`. Every hook callback is delegated to
///         the policy registered for that pool. Adding a new fund means
///         deploying a new IPolicy and calling `setPolicy` — no hook redeploy,
///         and no change to the mined hook address.
///
/// @dev    This contract makes exactly one external call per callback: into the
///         registered policy. It reads no oracle, holds no funds, and has no
///         loops. Everything it could get wrong is in `getHookPermissions()`,
///         which the constructor validates against the deployed address.
///
///         `beforeSwap` returns the zero delta and a zero fee override so the
///         hook can never take a fee or alter a swap — see IPolicy for why the
///         policy interface is narrowed to `bytes4`.
contract PolicyHook is BaseHook {
    using PoolIdLibrary for PoolKey;

    address public owner;

    mapping(PoolId => IPolicy) public policyOf;

    error NotOwner();
    error NoPolicyForPool(PoolId poolId);
    error PolicyRejected(PoolId poolId);

    event PolicySet(PoolId indexed poolId, address indexed policy);
    event OwnerTransferred(address indexed from, address indexed to);

    constructor(IPoolManager _poolManager, address _owner) BaseHook(_poolManager) {
        owner = _owner;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /// @notice Exactly `beforeSwap` and `afterSwap`, and no return-delta
    ///         permissions. The mined hook address must therefore satisfy
    ///         `uint160(addr) & Hooks.ALL_HOOK_MASK == 0xC0`
    ///         (BEFORE_SWAP_FLAG 1<<7 | AFTER_SWAP_FLAG 1<<6).
    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    function setPolicy(PoolId poolId, IPolicy policy) external onlyOwner {
        policyOf[poolId] = policy;
        emit PolicySet(poolId, address(policy));
    }

    function transferOwner(address to) external onlyOwner {
        emit OwnerTransferred(owner, to);
        owner = to;
    }

    // --- v4 hook callbacks ---------------------------------------------

    function beforeSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        bytes calldata hookData
    ) external override onlyPoolManager returns (bytes4, BeforeSwapDelta, uint24) {
        PoolId poolId = key.toId();
        IPolicy p = policyOf[poolId];
        if (address(p) == address(0)) revert NoPolicyForPool(poolId);

        // The policy reverts with its own named error on refusal. A non-matching
        // selector means the policy is not a policy — refuse rather than trust it.
        bytes4 sel = p.beforeSwap(sender, poolId, key, params, hookData);
        if (sel != IPolicy.beforeSwap.selector) revert PolicyRejected(poolId);

        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }

    function afterSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata
    ) external override onlyPoolManager returns (bytes4, int128) {
        PoolId poolId = key.toId();
        IPolicy p = policyOf[poolId];
        if (address(p) == address(0)) revert NoPolicyForPool(poolId);

        bytes4 sel = p.afterSwap(sender, poolId, key, params, delta.amount0(), delta.amount1());
        if (sel != IPolicy.afterSwap.selector) revert PolicyRejected(poolId);

        // Zero: this hook never takes a share of the swap output.
        return (BaseHook.afterSwap.selector, int128(0));
    }
}
