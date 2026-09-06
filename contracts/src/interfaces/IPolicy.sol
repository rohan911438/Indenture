// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId} from "v4-core/types/PoolId.sol";

/// @notice A pluggable per-pool policy. PolicyHook delegates the v4 hook
///         callbacks to whichever IPolicy is registered for a given PoolId.
///
/// @dev    Implementations MUST make zero external calls to untrusted code,
///         zero oracle reads, and contain no unbounded loops. They compare
///         fixed-width values already in storage and nothing else.
///
///         Two deliberate narrowings versus v4's own `IHooks`:
///
///         1. `beforeSwap` returns only `bytes4`, not v4's
///            `(bytes4, BeforeSwapDelta, uint24)`. A policy therefore CANNOT
///            alter the swap delta or the LP fee — it can only allow or revert.
///            PolicyHook supplies the zero delta and zero fee override. This
///            makes design rule 4 enforceable by the type system instead of by
///            code review.
///
///         2. `params` is the decoded `SwapParams` struct, not `bytes`. The
///            Validator binds a trade by signing
///            `keccak256(abi.encode(zeroForOne, amountSpecified, sqrtPriceLimitX96))`.
///            `SwapParams` is exactly those three static types, so a policy that
///            re-encodes the struct reproduces that hash byte for byte. Passing
///            `bytes` instead invited a mismatch between the raw calldata slice
///            and the ABI encoding, which would have reverted every real swap
///            with ParamsMismatch while unit tests passed.
interface IPolicy {
    /// @param sender    the address that called PoolManager.swap (the vault router)
    /// @param poolId    the pool being swapped
    /// @param key       the full PoolKey, for policies that need the currencies
    /// @param params    the decoded swap parameters — hashed to bind the receipt
    /// @param hookData  opaque bytes forwarded from the swap caller (the EIP-712 receipt)
    /// @return selector `IPolicy.beforeSwap.selector` on success; MUST revert
    ///                  with a named error otherwise
    function beforeSwap(
        address sender,
        PoolId poolId,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        bytes calldata hookData
    ) external returns (bytes4);

    /// @notice Called after the swap settles. Records post-trade covenant state
    ///         and emits BreachObserved when a snapshot is out of bounds.
    function afterSwap(
        address sender,
        PoolId poolId,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        int128 amount0,
        int128 amount1
    ) external returns (bytes4);

    /// @notice True when the portfolio is currently in breach of its mandate.
    ///         Read by MandateComplianceModule to freeze the share class.
    function inBreach() external view returns (bool);
}
