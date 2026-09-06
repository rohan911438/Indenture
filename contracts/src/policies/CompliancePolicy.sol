// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPolicy} from "../interfaces/IPolicy.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId} from "v4-core/types/PoolId.sol";

/// @notice Minimal ERC-3643 surface we depend on. Provided by the ATS suite
///         (deployed via the hashgraph/asset-tokenization-sdk - NOT hand-rolled).
///         Keeping the dependency to these two view functions is deliberate:
///         the ATS SDK evolves, and nothing else here should have to move with it.
interface IIdentityRegistry {
    function isVerified(address account) external view returns (bool);
}

interface IModularCompliance {
    function canTransfer(address from, address to, uint256 amount) external view returns (bool);
}

/// @title  CompliancePolicy
/// @notice The compliance half of Indenture: a swap counterparty must be a
///         verified identity and the transfer must pass modular compliance.
///         Qualifies for the Hedera track on its own.
///
/// @dev    On design rule 4: the rule bars the hook from reading ORACLES and
///         from calling untrusted code. The identity registry and the
///         ModularCompliance instance are neither — they are the fund's own
///         registered, owner-controlled infrastructure, and reading them is the
///         entire purpose of this policy. Both calls are `view`, to fixed
///         addresses set at construction, with no loops and no value transfer.
///         What the rule actually forbids — a price read, an unbounded loop, a
///         call to an address an attacker chose — none of that happens here.
contract CompliancePolicy is IPolicy {
    IIdentityRegistry public immutable identityRegistry;
    IModularCompliance public immutable compliance;

    /// @dev the only address allowed to invoke the callbacks
    address public immutable policyHook;

    error NotPolicyHook();
    error NotVerified(address account);
    error TransferNotCompliant(address from, address to, uint256 amount);

    /// @dev canonical journal event - see shared-contracts/contract-events.md.
    ///      Emitted immediately BEFORE the revert so the reason survives in the
    ///      trace even though the state change does not. The journaler reads it
    ///      from the mirror node either way.
    event ComplianceRefused(address indexed wouldBeHolder, bytes32 reason);

    constructor(IIdentityRegistry _identityRegistry, IModularCompliance _compliance, address _policyHook) {
        identityRegistry = _identityRegistry;
        compliance = _compliance;
        policyHook = _policyHook;
    }

    function beforeSwap(
        address sender,
        PoolId,
        PoolKey calldata,
        IPoolManager.SwapParams calldata params,
        bytes calldata
    ) external override returns (bytes4) {
        if (msg.sender != policyHook) revert NotPolicyHook();

        if (!identityRegistry.isVerified(sender)) {
            emit ComplianceRefused(sender, "notVerified");
            revert NotVerified(sender);
        }

        // The counterparty is the pool; the would-be holder is the vault. The
        // amount checked is the specified amount, which for an exact-input trade
        // is exactly what leaves, and for an exact-output trade is exactly what
        // arrives. Either way it is the number the mandate's holder limits are
        // written against.
        uint256 amount = params.amountSpecified < 0
            ? uint256(-params.amountSpecified)
            : uint256(params.amountSpecified);

        if (!compliance.canTransfer(msg.sender, sender, amount)) {
            emit ComplianceRefused(sender, "transferNotCompliant");
            revert TransferNotCompliant(msg.sender, sender, amount);
        }

        return IPolicy.beforeSwap.selector;
    }

    function afterSwap(address, PoolId, PoolKey calldata, IPoolManager.SwapParams calldata, int128, int128)
        external
        view
        override
        returns (bytes4)
    {
        if (msg.sender != policyHook) revert NotPolicyHook();
        return IPolicy.afterSwap.selector;
    }

    function inBreach() external pure override returns (bool) {
        return false; // compliance policy has no portfolio state
    }
}
