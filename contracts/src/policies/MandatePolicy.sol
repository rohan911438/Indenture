// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPolicy} from "../interfaces/IPolicy.sol";
import {ReceiptLib} from "../libs/ReceiptLib.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId} from "v4-core/types/PoolId.sol";

/// @title  MandatePolicy
/// @notice The trading half of Indenture. Before any swap it:
///           1. recovers the EIP-712 receipt signer (ecrecover) and checks it
///              equals the registered `validatorSigner`;
///           2. binds the receipt to (mandateHash, seq, paramsHash, vault,
///              deadline) so a receipt authorises exactly one trade, once;
///           3. runs 4 integer covenant checks against values already in
///              storage - no external calls, no oracle reads, no loops.
///         `amend()` (owner-only) rotates the mandate hash / covenant params.
/// @dev    STUB - build step 7. Signature + binding FIRST, covenants SECOND.
contract MandatePolicy is IPolicy {
    using ReceiptLib for ReceiptLib.Receipt;

    address public owner;
    /// @dev the only address allowed to invoke the callbacks; set at construction
    address public immutable policyHook;
    address public validatorSigner; // pluggable: service today, Chainlink DON later
    /// @dev EIP-712 domain separator, computed over THIS contract. Passing it
    ///      in would let a deploy script bind receipts to the wrong verifying
    ///      contract, which no test would catch until signatures silently
    ///      failed to recover on chain.
    bytes32 public immutable domainSeparator;
    bytes32 public mandateHash;
    uint64 public mandateSeq; // bumped on every amend(); mirrored to the journal

    // --- covenant parameters (fixed-width, set by amend) ---
    uint256 public maxPositionBps; // max single-asset weight, basis points
    uint256 public minCashBps; // min stablecoin reserve, basis points
    uint256 public maxTradeNotional; // per-trade cap, quote units
    uint256 public maxDailyNotional; // rolling 24h cap, quote units

    // --- runtime state ---
    mapping(address => uint64) public seqOf; // per-vault monotonic nonce
    bool private _inBreach;

    error NotPolicyHook();
    error BadSigner(address recovered);
    error StaleMandate(bytes32 got, bytes32 expected);
    error WrongPool(bytes32 got);
    error ReceiptExpired(uint64 deadline);
    error WrongVault(address vault);
    error StaleSeq(uint64 got, uint64 expected);
    error ParamsMismatch(bytes32 got, bytes32 expected);
    error CovenantMaxPosition();
    error CovenantMinCash();
    error CovenantTradeNotional();
    error CovenantDailyNotional();

    /// @dev canonical journal events - see shared-contracts/contract-events.md.
    event Amended(bytes32 indexed indentureHash, uint64 indexed seq);
    event BreachObserved(uint64 indexed nonce, bytes32 indexed poolId, bytes32 reason);
    event ValidatorSignerSet(address indexed signer);
    event ReceiptConsumed(address indexed vault, uint64 seq, bytes32 paramsHash);

    constructor(address _owner, address _policyHook, address _validatorSigner) {
        owner = _owner;
        policyHook = _policyHook;
        validatorSigner = _validatorSigner;
        domainSeparator = ReceiptLib.domainSeparator(block.chainid, address(this));
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    function setValidatorSigner(address s) external onlyOwner {
        validatorSigner = s;
        emit ValidatorSignerSet(s);
    }

    function amend(
        bytes32 _mandateHash,
        uint256 _maxPositionBps,
        uint256 _minCashBps,
        uint256 _maxTradeNotional,
        uint256 _maxDailyNotional
    ) external onlyOwner {
        mandateHash = _mandateHash;
        maxPositionBps = _maxPositionBps;
        minCashBps = _minCashBps;
        maxTradeNotional = _maxTradeNotional;
        maxDailyNotional = _maxDailyNotional;
        unchecked {
            mandateSeq += 1;
        }
        emit Amended(_mandateHash, mandateSeq);
    }

    function beforeSwap(
        address sender,
        PoolId poolId,
        PoolKey calldata,
        IPoolManager.SwapParams calldata params,
        bytes calldata hookData
    ) external override returns (bytes4) {
        if (msg.sender != policyHook) revert NotPolicyHook();

        // hookData = abi.encode(ReceiptLib.Receipt, bytes signature)
        (ReceiptLib.Receipt memory r, bytes memory sig) =
            abi.decode(hookData, (ReceiptLib.Receipt, bytes));

        // 1. signer
        address recovered = _recover(r.digest(domainSeparator), sig);
        if (recovered != validatorSigner) revert BadSigner(recovered);

        // 2. binding — a receipt authorises exactly one trade, on one pool,
        //    for one vault, once, before one deadline.
        if (block.timestamp > r.deadline) revert ReceiptExpired(r.deadline);
        if (r.vault != sender) revert WrongVault(r.vault);
        if (r.mandateHash != mandateHash) revert StaleMandate(r.mandateHash, mandateHash);
        if (r.poolId != PoolId.unwrap(poolId)) revert WrongPool(r.poolId);

        uint64 expected = seqOf[sender];
        if (r.seq != expected) revert StaleSeq(r.seq, expected);

        // `SwapParams` is {bool, int256, uint160} — three static types — so this
        // is byte-identical to the Validator's
        // keccak256(abi.encode(zeroForOne, amountSpecified, sqrtPriceLimitX96)).
        // Router.t.sol asserts that against a receipt signed in TypeScript.
        bytes32 ph = keccak256(abi.encode(params));
        if (r.paramsHash != ph) revert ParamsMismatch(ph, r.paramsHash);

        seqOf[sender] = expected + 1;

        // 3. covenants — Sprint 2. Until then a signature authorises any size
        //    of trade, which is exactly the gap docs/PLAN.md Sprint 2 closes.

        emit ReceiptConsumed(sender, r.seq, ph);
        return IPolicy.beforeSwap.selector;
    }

    function afterSwap(address, PoolId, PoolKey calldata, IPoolManager.SwapParams calldata, int128, int128)
        external
        pure
        override
        returns (bytes4)
    {
        // Sprint 2: compare the post-trade snapshot and emit BreachObserved.
        return IPolicy.afterSwap.selector;
    }

    function inBreach() external view override returns (bool) {
        return _inBreach;
    }

    function _recover(bytes32 h, bytes memory sig) private pure returns (address) {
        if (sig.length != 65) return address(0);
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(sig, 0x20))
            s := mload(add(sig, 0x40))
            v := byte(0, mload(add(sig, 0x60)))
        }
        return ecrecover(h, v, r, s);
    }
}
