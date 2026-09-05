// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title  IndentureVault
/// @notice The fund. It is its own Uniswap v4 router: it holds the assets,
///         takes the PoolManager unlock callback, and drives the
///         swap / sync / settle / take sequence for a single proposed trade.
///         The receipt (EIP-712, signed by the Validator) rides in `hookData`
///         so PolicyHook -> MandatePolicy can verify it inside `beforeSwap`.
///
///         `emergencyExit` is deliberately OUTSIDE any policy: the owner can
///         always pull the fund to a safe address, even mid-breach, even if a
///         policy contract is bricked.
/// @dev    STUB - build step 5. Test every branch to zero deltas on anvil.
contract IndentureVault {
    address public owner;
    address public poolManager;
    address public manager; // the untrusted proposer's key; can only call `trade`

    error NotOwner();
    error NotManager();
    error NotPoolManager();
    error NonZeroDelta(int256 delta0, int256 delta1);

    /// @dev canonical journal event - see shared-contracts/contract-events.md.
    ///      `nonce` is the per-vault receipt seq that authorised the trade.
    event Executed(uint64 indexed nonce, bytes32 indexed poolId, int256 amount0, int256 amount1);
    event EmergencyExit(address indexed to);

    constructor(address _owner, address _poolManager, address _manager) {
        owner = _owner;
        poolManager = _poolManager;
        manager = _manager;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyManager() {
        if (msg.sender != manager) revert NotManager();
        _;
    }

    /// @notice Manager submits a Validator-signed trade. `receiptBlob` is
    ///         abi.encode(Receipt, signature) and is forwarded verbatim as
    ///         v4 hookData - the vault never inspects or trusts it.
    function trade(bytes calldata key, bytes calldata params, bytes calldata receiptBlob)
        external
        onlyManager
    {
        // IPoolManager(poolManager).unlock(abi.encode(key, params, receiptBlob));
        // -> unlockCallback drives swap/sync/settle/take, then asserts flat.
    }

    /// @dev PoolManager.unlock callback. Reverts unless every currency delta
    ///      is settled to exactly zero.
    function unlockCallback(bytes calldata /*data*/ ) external returns (bytes memory) {
        if (msg.sender != poolManager) revert NotPoolManager();
        // decode, swap, settle inputs, take outputs, assert flat
        return "";
    }

    /// @notice Unconditional. Not gated by any policy. Owner-only.
    function emergencyExit(address to) external onlyOwner {
        emit EmergencyExit(to);
        // sweep every held currency to `to`
    }
}
