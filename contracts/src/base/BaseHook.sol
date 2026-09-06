// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {BeforeSwapDelta} from "v4-core/types/BeforeSwapDelta.sol";

/// @title  BaseHook
/// @notice A deliberately minimal `IHooks` base. Every callback reverts unless
///         a subclass overrides it, and the constructor asserts that the
///         deployed address encodes exactly the permissions the subclass
///         declares.
///
/// @dev    Why this is hand-written rather than vendored:
///
///         v4-periphery removed `BaseHook` (Uniswap/v4-periphery#510, "remove
///         hooks and move to hook repo"), so there is no version of it to pin
///         to a tag. More importantly, design rule 4 says the hook makes zero
///         external calls, zero oracle reads and has no unbounded loops. That
///         is a claim about the ENTIRE inherited surface, not just the code in
///         `PolicyHook`. Eighty auditable lines we own is a better guarantee of
///         that than a dependency, and it is the same argument the rest of this
///         codebase makes for freezing its own seams.
///
///         The `Hooks.Permissions` struct has 14 fields; getting one wrong
///         silently changes which callbacks `PoolManager` invokes. That is why
///         `validateHookAddress` runs in the constructor — a mis-mined address
///         fails at deploy time, not at the first swap.
abstract contract BaseHook is IHooks {
    IPoolManager public immutable poolManager;

    /// @notice A callback fired that this hook does not implement. Reaching
    ///         this means the address bits and `getHookPermissions()` disagree,
    ///         which the constructor should have made impossible.
    error HookNotImplemented();

    /// @notice Only `PoolManager` may invoke a hook callback.
    error NotPoolManager();

    constructor(IPoolManager _poolManager) {
        poolManager = _poolManager;
        Hooks.validateHookPermissions(IHooks(address(this)), getHookPermissions());
    }

    /// @dev Every callback carries this. A hook that can be called directly is
    ///      a hook whose `sender` argument is attacker-controlled.
    modifier onlyPoolManager() {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        _;
    }

    /// @notice The permissions this hook implements. MUST match the low 14 bits
    ///         of the deployed address — see `script/02_Hook.s.sol` for mining.
    function getHookPermissions() public pure virtual returns (Hooks.Permissions memory);

    // ---------------------------------------------------------------------
    // Default: revert. A subclass overrides only what it declares permission
    // for, so an undeclared callback can never silently succeed.
    // ---------------------------------------------------------------------

    function beforeInitialize(address, PoolKey calldata, uint160) external virtual returns (bytes4) {
        revert HookNotImplemented();
    }

    function afterInitialize(address, PoolKey calldata, uint160, int24) external virtual returns (bytes4) {
        revert HookNotImplemented();
    }

    function beforeAddLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        bytes calldata
    ) external virtual returns (bytes4) {
        revert HookNotImplemented();
    }

    function afterAddLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external virtual returns (bytes4, BalanceDelta) {
        revert HookNotImplemented();
    }

    function beforeRemoveLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        bytes calldata
    ) external virtual returns (bytes4) {
        revert HookNotImplemented();
    }

    function afterRemoveLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external virtual returns (bytes4, BalanceDelta) {
        revert HookNotImplemented();
    }

    function beforeSwap(address, PoolKey calldata, IPoolManager.SwapParams calldata, bytes calldata)
        external
        virtual
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        revert HookNotImplemented();
    }

    function afterSwap(address, PoolKey calldata, IPoolManager.SwapParams calldata, BalanceDelta, bytes calldata)
        external
        virtual
        returns (bytes4, int128)
    {
        revert HookNotImplemented();
    }

    function beforeDonate(address, PoolKey calldata, uint256, uint256, bytes calldata)
        external
        virtual
        returns (bytes4)
    {
        revert HookNotImplemented();
    }

    function afterDonate(address, PoolKey calldata, uint256, uint256, bytes calldata)
        external
        virtual
        returns (bytes4)
    {
        revert HookNotImplemented();
    }
}
