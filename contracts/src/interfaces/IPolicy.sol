// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice A pluggable per-pool policy. PolicyHook delegates the v4 hook
///         callbacks to whichever IPolicy is registered for a given PoolId.
/// @dev    Implementations MUST make zero external calls to untrusted code,
///         zero oracle reads, and contain no unbounded loops. They compare
///         fixed-width values already in storage and nothing else.
interface IPolicy {
    /// @param sender    the address that called PoolManager.swap (the vault router)
    /// @param key       abi-encoded PoolKey for the pool being swapped
    /// @param params    abi-encoded SwapParams (zeroForOne, amountSpecified, sqrtPriceLimitX96)
    /// @param hookData   opaque bytes forwarded from the swap caller (e.g. the EIP-712 receipt)
    /// @return selector  the beforeSwap selector on success; MUST revert with a named error otherwise
    function beforeSwap(address sender, bytes calldata key, bytes calldata params, bytes calldata hookData)
        external
        returns (bytes4 selector);

    /// @notice Called after the swap settles. Used to record post-trade covenant state.
    function afterSwap(address sender, bytes calldata key, bytes calldata params, int256 delta0, int256 delta1)
        external
        returns (bytes4 selector);

    /// @notice True when the portfolio is currently in breach of its mandate.
    ///         Read by MandateComplianceModule to freeze the share class.
    function inBreach() external view returns (bool);
}
