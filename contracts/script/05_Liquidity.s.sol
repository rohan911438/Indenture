// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Deployments} from "./Deployments.sol";
import {console2} from "forge-std/Script.sol";
import {PoolModifyLiquidityTest} from "v4-core/test/PoolModifyLiquidityTest.sol";
import {MockAggregatorV3} from "../src/mocks/MockAggregatorV3.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {MockAsset} from "../src/mocks/MockAsset.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {IERC20Minimal} from "v4-core/interfaces/external/IERC20Minimal.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";

/// Seeds the pool so a trade can actually execute, and — on local chains only —
/// deploys a stand-in price feed.
///
/// Split out from 04_Wire because it is DEMO SETUP, not fund wiring: a real
/// fund's liquidity comes from real LPs, and on Hedera testnet the price feed
/// is Chainlink's, not ours (docs/RESEARCH.md section 1.3). Keeping it separate
/// means the wiring script stays honest about what the fund actually needs.
contract SeedLiquidity is Deployments {
    uint24 internal constant FEE = 3000;
    int24 internal constant TICK_SPACING = 60;

    function run() external {
        address poolManager = _requireAddr(".contracts.PoolManager");
        address hookAddr = _requireAddr(".contracts.PolicyHook");
        address usdc = _requireAddr(".contracts.MockUSDC");
        address asset = _requireAddr(".contracts.MockAsset");

        (address c0, address c1) = usdc < asset ? (usdc, asset) : (asset, usdc);
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(c0),
            currency1: Currency.wrap(c1),
            fee: FEE,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(hookAddr)
        });

        uint256 pk = _deployerKey();
        address me = vm.addr(pk);

        vm.startBroadcast(pk);

        // A price feed, for chains that do not have Chainlink. $1 at 8dp, which
        // makes the 1:1 pool price and the feed price agree.
        if (_readDeployed(".contracts.ChainlinkPriceFeed") == address(0)) {
            MockAggregatorV3 feed = new MockAggregatorV3(1e8, 8);
            _writeAddr(".contracts.ChainlinkPriceFeed", address(feed));
        }

        PoolModifyLiquidityTest lp = new PoolModifyLiquidityTest(IPoolManager(poolManager));

        // Full range needs amount0 ~ L/sqrt(P) and amount1 ~ L*sqrt(P). The
        // pool is initialized at the 1e12 raw-unit ratio between a 6dp quote
        // and an 18dp asset (see 04_Wire), so sqrt(P) is 1e6 and L = 1e18
        // gives roughly 1,000,000 of each token whichever way the currencies
        // sorted. Mint well above that; these are mocks.
        MockUSDC(usdc).mint(me, 1e26);
        MockAsset(asset).mint(me, 1e26);
        IERC20Minimal(c0).approve(address(lp), type(uint256).max);
        IERC20Minimal(c1).approve(address(lp), type(uint256).max);

        lp.modifyLiquidity(
            key,
            IPoolManager.ModifyLiquidityParams({
                tickLower: TickMath.minUsableTick(TICK_SPACING),
                tickUpper: TickMath.maxUsableTick(TICK_SPACING),
                liquidityDelta: 1e18,
                salt: bytes32(0)
            }),
            ""
        );

        vm.stopBroadcast();

        console2.log("liquidity seeded via", address(lp));
    }
}
