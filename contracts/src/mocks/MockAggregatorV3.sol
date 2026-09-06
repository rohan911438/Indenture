// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice A Chainlink AggregatorV3 stand-in for local chains ONLY.
///
/// @dev    On Hedera testnet the real feeds already exist and MUST be used —
///         see docs/RESEARCH.md section 1.3 for the seven addresses. Deploying
///         a feed there would mean the fund's prices came from us, which
///         defeats the point of having an oracle at all.
///
///         This exists so the full loop can be rehearsed on anvil, where there
///         is no Chainlink. `answeredInRound` and `roundId` are fixed; only
///         `answer` and `updatedAt` matter to the Validator, and `updatedAt` is
///         settable so the staleness refusal can actually be exercised.
contract MockAggregatorV3 {
    int256 public answer;
    uint256 public updatedAt;
    uint8 public immutable decimals;

    constructor(int256 _answer, uint8 _decimals) {
        answer = _answer;
        decimals = _decimals;
        updatedAt = block.timestamp;
    }

    function setAnswer(int256 a) external {
        answer = a;
        updatedAt = block.timestamp;
    }

    /// @notice Age the feed on purpose, to exercise the Validator's refusal.
    function setUpdatedAt(uint256 t) external {
        updatedAt = t;
    }

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer_, uint256 startedAt, uint256 updatedAt_, uint80 answeredInRound)
    {
        return (1, answer, updatedAt, updatedAt, 1);
    }
}
