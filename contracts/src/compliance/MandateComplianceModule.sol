// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IBreachSource {
    function inBreach() external view returns (bool);
}

/// @title  MandateComplianceModule
/// @notice An ERC-3643 ModularCompliance module. `canTransfer` returns false
///         for the whole share class whenever `MandatePolicy.inBreach()` is
///         true - a portfolio breach freezes redemptions/transfers until the
///         mandate is back in compliance. This is the cross-link that turns an
///         off-mandate trade into a visible, on-chain consequence.
/// @dev    STUB - build step 9. Wired into the ATS ModularCompliance instance.
contract MandateComplianceModule {
    IBreachSource public immutable mandatePolicy;
    address public immutable compliance; // the ModularCompliance that may call bind/unbind

    error BoundElsewhere();

    constructor(IBreachSource _mandatePolicy, address _compliance) {
        mandatePolicy = _mandatePolicy;
        compliance = _compliance;
    }

    /// @notice ERC-3643 module hook. Called by ModularCompliance on transfer.
    function moduleCheck(address, /*from*/ address, /*to*/ uint256, /*value*/ address /*compliance*/ )
        external
        view
        returns (bool)
    {
        return !mandatePolicy.inBreach();
    }

    function isPlugAndPlay() external pure returns (bool) {
        return true;
    }

    function name() external pure returns (string memory) {
        return "MandateComplianceModule";
    }
}
