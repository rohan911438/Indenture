// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IPolicy} from "../interfaces/IPolicy.sol";
import {ReceiptLib} from "../libs/ReceiptLib.sol";

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
    address public validatorSigner; // pluggable: service today, Chainlink DON later
    bytes32 public domainSeparator;
    bytes32 public mandateHash;

    // --- covenant parameters (fixed-width, set by amend) ---
    uint256 public maxPositionBps; // max single-asset weight, basis points
    uint256 public minCashBps; // min stablecoin reserve, basis points
    uint256 public maxTradeNotional; // per-trade cap, quote units
    uint256 public maxDailyNotional; // rolling 24h cap, quote units

    // --- runtime state ---
    mapping(address => uint64) public seqOf; // per-vault monotonic nonce
    bool private _inBreach;

    error BadSigner(address recovered);
    error ReceiptExpired(uint64 deadline);
    error WrongVault(address vault);
    error StaleSeq(uint64 got, uint64 expected);
    error ParamsMismatch(bytes32 got, bytes32 expected);
    error CovenantMaxPosition();
    error CovenantMinCash();
    error CovenantTradeNotional();
    error CovenantDailyNotional();

    event Amended(bytes32 indexed mandateHash);
    event ValidatorSignerSet(address indexed signer);
    event ReceiptConsumed(address indexed vault, uint64 seq, bytes32 paramsHash);

    constructor(address _owner, address _validatorSigner, bytes32 _domainSeparator) {
        owner = _owner;
        validatorSigner = _validatorSigner;
        domainSeparator = _domainSeparator;
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
        emit Amended(_mandateHash);
    }

    function beforeSwap(address sender, bytes calldata, bytes calldata params, bytes calldata hookData)
        external
        override
        returns (bytes4)
    {
        // hookData = abi.encode(ReceiptLib.Receipt, bytes signature)
        (ReceiptLib.Receipt memory r, bytes memory sig) =
            abi.decode(hookData, (ReceiptLib.Receipt, bytes));

        // 1. signer
        address recovered = _recover(r.digest(domainSeparator), sig);
        if (recovered != validatorSigner) revert BadSigner(recovered);

        // 2. binding
        if (block.timestamp > r.deadline) revert ReceiptExpired(r.deadline);
        if (r.vault != sender) revert WrongVault(r.vault);
        if (r.mandateHash != mandateHash) revert ParamsMismatch(r.mandateHash, mandateHash);
        uint64 expected = seqOf[sender];
        if (r.seq != expected) revert StaleSeq(r.seq, expected);
        bytes32 ph = keccak256(params);
        if (r.paramsHash != ph) revert ParamsMismatch(ph, r.paramsHash);
        seqOf[sender] = expected + 1;

        // 3. covenants - TODO: compare against post-trade portfolio snapshot
        //    already written to storage by the vault's sync() step.

        emit ReceiptConsumed(sender, r.seq, ph);
        return this.beforeSwap.selector;
    }

    function afterSwap(address, bytes calldata, bytes calldata, int256, int256)
        external
        pure
        override
        returns (bytes4)
    {
        return this.afterSwap.selector;
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
