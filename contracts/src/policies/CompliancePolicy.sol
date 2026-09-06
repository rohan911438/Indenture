// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPolicy} from "../interfaces/IPolicy.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId} from "v4-core/types/PoolId.sol";

/// @notice Minimal ERC-3643 surface we depend on. Provided by the ATS suite
///         (deployed via the hashgraph/asset-tokenization-sdk - NOT hand-rolled).
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
/// @dev    STUB - build step 4. Reads only ATS view functions; no loops.
contract CompliancePolicy is IPolicy {
    IIdentityRegistry public immutable identityRegistry;
    IModularCompliance public immutable compliance;

    error NotVerified(address account);
    error TransferNotCompliant(address from, address to, uint256 amount);

    /// @dev canonical journal event - see shared-contracts/contract-events.md.
    ///      Emitted from a non-reverting rejection path once step 4 wires the
    ///      counterparty / amount extraction; declaration frozen here.
    event ComplianceRefused(address indexed wouldBeHolder, bytes32 reason);

    constructor(IIdentityRegistry _identityRegistry, IModularCompliance _compliance) {
        identityRegistry = _identityRegistry;
        compliance = _compliance;
    }

    function beforeSwap(
        address sender,
        PoolId,
        PoolKey calldata,
        IPoolManager.SwapParams calldata,
        bytes calldata
    ) external view override returns (bytes4) {
        if (!identityRegistry.isVerified(sender)) revert NotVerified(sender);
        // amount / counterparty extraction from params is wired in on Sprint 3
        return IPolicy.beforeSwap.selector;
    }

    function afterSwap(address, PoolId, PoolKey calldata, IPoolManager.SwapParams calldata, int128, int128)
        external
        pure
        override
        returns (bytes4)
    {
        return IPolicy.afterSwap.selector;
    }

    function inBreach() external pure override returns (bool) {
        return false; // compliance policy has no portfolio state
    }
}
