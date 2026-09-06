// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice The risk asset side of the fund's pool — the thing the mandate's
///         maxPositionBps covenant is written about. 18 decimals, so the pool
///         exercises the mixed-decimal path rather than a convenient 6/6 case.
///         Its Chainlink feed is read-only and already on testnet; do not
///         deploy a price feed here.
contract MockAsset is ERC20 {
    constructor() ERC20("Mock Asset", "mASSET") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
