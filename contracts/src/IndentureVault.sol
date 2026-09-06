// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "v4-core/interfaces/callback/IUnlockCallback.sol";
import {IERC20Minimal} from "v4-core/interfaces/external/IERC20Minimal.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {TransientStateLibrary} from "v4-core/libraries/TransientStateLibrary.sol";
import {ReceiptLib} from "./libs/ReceiptLib.sol";

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
///
/// @dev    The vault is the thing being CONSTRAINED, so it is deliberately
///         dumb. It never inspects `receiptBlob` — it forwards it verbatim as
///         v4 hookData and lets MandatePolicy be the only judge of it. The one
///         exception is decoding `seq` for the `Executed` event, which is a
///         label on a journal entry, not a decision.
contract IndentureVault is IUnlockCallback {
    using PoolIdLibrary for PoolKey;
    using TransientStateLibrary for IPoolManager;

    address public owner;
    IPoolManager public immutable poolManager;
    address public manager; // the untrusted proposer's key; can only call `trade`

    error NotOwner();
    error NotManager();
    error NotPoolManager();
    error NonZeroDelta(int256 delta0, int256 delta1);

    /// @dev canonical journal event - see shared-contracts/contract-events.md.
    ///      `nonce` is the per-vault receipt seq that authorised the trade.
    event Executed(uint64 indexed nonce, bytes32 indexed poolId, int256 amount0, int256 amount1);
    event EmergencyExit(address indexed to);
    event ManagerSet(address indexed manager);

    constructor(address _owner, IPoolManager _poolManager, address _manager) {
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

    function setManager(address _manager) external onlyOwner {
        manager = _manager;
        emit ManagerSet(_manager);
    }

    /// @notice Manager submits a Validator-signed trade. `receiptBlob` is
    ///         abi.encode(Receipt, signature) and is forwarded verbatim as
    ///         v4 hookData - the vault never inspects or trusts it.
    function trade(PoolKey calldata key, IPoolManager.SwapParams calldata params, bytes calldata receiptBlob)
        external
        onlyManager
    {
        poolManager.unlock(abi.encode(key, params, receiptBlob));
    }

    /// @dev PoolManager.unlock callback. Reverts unless every currency delta
    ///      is settled to exactly zero.
    function unlockCallback(bytes calldata data) external override returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();

        (PoolKey memory key, IPoolManager.SwapParams memory params, bytes memory receiptBlob) =
            abi.decode(data, (PoolKey, IPoolManager.SwapParams, bytes));

        // beforeSwap runs inside this call. A refusal reverts here, unwinding
        // the whole unlock — nothing settles, nothing moves.
        BalanceDelta delta = poolManager.swap(key, params, receiptBlob);

        _settleAll(key, delta);

        // Flat or revert. A leftover delta means the router logic is wrong, and
        // PoolManager would revert on lock release anyway — this gives a named
        // error and the two amounts instead of an opaque failure.
        int256 d0 = poolManager.currencyDelta(address(this), key.currency0);
        int256 d1 = poolManager.currencyDelta(address(this), key.currency1);
        if (d0 != 0 || d1 != 0) revert NonZeroDelta(d0, d1);

        (ReceiptLib.Receipt memory r,) = abi.decode(receiptBlob, (ReceiptLib.Receipt, bytes));
        emit Executed(r.seq, PoolId.unwrap(key.toId()), delta.amount0(), delta.amount1());

        return "";
    }

    /// @dev Virtual only so a test can skip settlement and prove the
    ///      NonZeroDelta guard below actually fires. Not an extension point.
    function _settleAll(PoolKey memory key, BalanceDelta delta) internal virtual {
        _settle(key.currency0, delta.amount0());
        _settle(key.currency1, delta.amount1());
    }

    /// @dev Negative delta = the vault owes the pool: sync, transfer, settle.
    ///      Positive delta = the pool owes the vault: take.
    function _settle(Currency currency, int128 amount) private {
        if (amount < 0) {
            uint256 owed = uint256(uint128(-amount));
            poolManager.sync(currency);
            IERC20Minimal(Currency.unwrap(currency)).transfer(address(poolManager), owed);
            poolManager.settle();
        } else if (amount > 0) {
            poolManager.take(currency, address(this), uint256(uint128(amount)));
        }
    }

    /// @notice Unconditional. Not gated by any policy, and reachable while the
    ///         portfolio is in breach — a bricked or hostile policy must never
    ///         be able to trap the fund.
    function emergencyExit(address to, Currency[] calldata currencies) external onlyOwner {
        emit EmergencyExit(to);
        for (uint256 i = 0; i < currencies.length; i++) {
            IERC20Minimal token = IERC20Minimal(Currency.unwrap(currencies[i]));
            uint256 bal = token.balanceOf(address(this));
            if (bal > 0) token.transfer(to, bal);
        }
    }
}
