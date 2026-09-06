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

    uint256 private constant BPS = 10_000;

    // --- covenant parameters (fixed-width, set by amend) ---
    uint256 public maxPositionBps; // max single-asset weight, basis points
    uint256 public minCashBps; // min stablecoin reserve, basis points
    uint256 public maxTradeNotional; // per-trade cap, quote units
    uint256 public maxDailyNotional; // rolling 24h cap, quote units

    /// @dev The one vault whose snapshots this policy accepts. Registered by
    ///      the owner at wiring time; see script/04_Wire.s.sol.
    address public vault;

    /// @dev Which side of the pool is the quote (cash) currency. Set with the
    ///      covenant params, because the notional caps are denominated in it.
    bool public quoteIsCurrency0;

    // --- runtime state ---
    mapping(address => uint64) public seqOf; // per-vault monotonic nonce
    uint64 public lastSeq; // seq of the receipt currently being executed
    uint64 public currentDay; // block.timestamp / 1 days, for the rolling cap
    uint256 public dailyNotional; // quote units executed within currentDay
    bool private _inBreach;

    error NotPolicyHook();
    error BadSigner(address recovered);
    error StaleMandate(bytes32 got, bytes32 expected);
    error WrongPool(bytes32 got);
    error ReceiptExpired(uint64 deadline);
    error WrongVault(address vault);
    error StaleSeq(uint64 got, uint64 expected);
    error ParamsMismatch(bytes32 got, bytes32 expected);
    error CovenantMaxPosition(uint256 observedBps, uint256 limitBps);
    error CovenantMinCash(uint256 observedBps, uint256 floorBps);
    error CovenantTradeNotional(uint256 observed, uint256 limit);
    error CovenantDailyNotional(uint256 wouldReach, uint256 limit);
    error NotTheVault(address caller);
    error ZeroNav();

    /// @dev canonical journal events - see shared-contracts/contract-events.md.
    event Amended(bytes32 indexed indentureHash, uint64 indexed seq);
    event BreachObserved(uint64 indexed nonce, bytes32 indexed poolId, bytes32 reason);
    event ValidatorSignerSet(address indexed signer);
    event VaultSet(address indexed vault);
    event ReceiptConsumed(address indexed vault, uint64 seq, bytes32 paramsHash);
    event Settled(address indexed vault, uint64 seq, uint256 notional, uint256 dailyTotal);
    event SnapshotObserved(
        address indexed vault, uint64 seq, uint256 positionBps, uint256 cashBps, bool inBreach
    );

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

    function setVault(address v) external onlyOwner {
        vault = v;
        emit VaultSet(v);
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
        uint256 _maxDailyNotional,
        bool _quoteIsCurrency0
    ) external onlyOwner {
        mandateHash = _mandateHash;
        quoteIsCurrency0 = _quoteIsCurrency0;
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
        lastSeq = r.seq;

        // 3. covenants. The size caps are enforced in afterSwap, where the
        //    ACTUAL settled quote delta is known — see the note there. Nothing
        //    useful can be checked here that afterSwap cannot check better.

        emit ReceiptConsumed(sender, r.seq, ph);
        return IPolicy.beforeSwap.selector;
    }

    /// @notice Enforces the two size covenants, and is where the mandate stops
    ///         being advice.
    ///
    /// @dev    WHY HERE AND NOT IN beforeSwap.
    ///
    ///         `params.amountSpecified` is denominated in whichever currency the
    ///         caller chose, and for an exact-output trade the amount that
    ///         actually moves is not known until the swap has run. `afterSwap`
    ///         receives the settled deltas, so the quote-currency amount here is
    ///         the real one — not a promise. Reverting still unwinds the entire
    ///         `unlock`, so this is prevention, not just observation.
    ///
    ///         WHAT THIS DEFENDS AGAINST.
    ///
    ///         These two checks read nothing but `params`-derived deltas and
    ///         this contract's own storage. No price, no balance, no external
    ///         call. So they hold even if the Validator's key is stolen and it
    ///         signs a receipt for a trade far outside the mandate: the
    ///         signature gets the trade as far as the swap, and the size cap
    ///         still reverts it. That is the claim in the README, and these are
    ///         the covenants that can honestly back it.
    ///
    ///         The other two covenants (maxPositionBps, minCashBps) are weights
    ///         against NAV, which cannot be computed without prices. Design rule
    ///         4 forbids the hook from reading an oracle, so they are enforced
    ///         off-chain by the Validator and *observed* on-chain by
    ///         `observeSnapshot` below. `BreachObserved` is named "observed" in
    ///         shared-contracts/contract-events.md for exactly this reason.
    function afterSwap(
        address sender,
        PoolId poolId,
        PoolKey calldata,
        IPoolManager.SwapParams calldata,
        int128 amount0,
        int128 amount1
    ) external override returns (bytes4) {
        if (msg.sender != policyHook) revert NotPolicyHook();

        int128 quoteDelta = quoteIsCurrency0 ? amount0 : amount1;
        uint256 notional = quoteDelta < 0 ? uint256(uint128(-quoteDelta)) : uint256(uint128(quoteDelta));

        if (notional > maxTradeNotional) {
            emit BreachObserved(lastSeq, PoolId.unwrap(poolId), "maxTradeNotional");
            revert CovenantTradeNotional(notional, maxTradeNotional);
        }

        // Rolling 24h window as fixed-width day buckets. A mapping keyed by day
        // would grow without bound; two slots that reset on rollover do not,
        // and there are no loops either way.
        uint64 today = uint64(block.timestamp / 1 days);
        uint256 runningTotal = (today == currentDay) ? dailyNotional + notional : notional;

        if (runningTotal > maxDailyNotional) {
            emit BreachObserved(lastSeq, PoolId.unwrap(poolId), "maxDailyNotional");
            revert CovenantDailyNotional(runningTotal, maxDailyNotional);
        }

        currentDay = today;
        dailyNotional = runningTotal;

        emit Settled(sender, lastSeq, notional, runningTotal);
        return IPolicy.afterSwap.selector;
    }

    /// @notice The vault reports its own post-trade portfolio, derived from its
    ///         own balances and price feeds. Weight covenants are checked here
    ///         and a breach freezes the share class via
    ///         MandateComplianceModule.
    ///
    /// @dev    This is DETECTION, not prevention, and the difference matters:
    ///         the numbers come from the vault, so this defends against a
    ///         compromised Manager (which can only call `trade`, and cannot make
    ///         the vault misreport its own balances) but not against a
    ///         compromised vault owner. The size covenants above are the ones
    ///         that hold unconditionally.
    ///
    ///         A breach does not revert. Refusing the report would leave the
    ///         fund in breach AND unrecorded, which is strictly worse — the
    ///         product's whole premise is that breaches become visible.
    function observeSnapshot(uint256 navQuote, uint256 positionQuote, uint256 cashQuote, bytes32 poolIdRaw)
        external
    {
        if (msg.sender != vault) revert NotTheVault(msg.sender);
        if (navQuote == 0) revert ZeroNav();

        bool breached;

        uint256 positionBps = (positionQuote * BPS) / navQuote;
        if (positionBps > maxPositionBps) {
            emit BreachObserved(lastSeq, poolIdRaw, "maxPositionBps");
            breached = true;
        }

        uint256 cashBps = (cashQuote * BPS) / navQuote;
        if (cashBps < minCashBps) {
            emit BreachObserved(lastSeq, poolIdRaw, "minCashBps");
            breached = true;
        }

        _inBreach = breached;
        emit SnapshotObserved(msg.sender, lastSeq, positionBps, cashBps, breached);
    }

    /// @notice Owner can clear a breach once the portfolio is back in bounds —
    ///         otherwise a single bad tick would freeze the share class forever.
    function clearBreach() external onlyOwner {
        _inBreach = false;
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
