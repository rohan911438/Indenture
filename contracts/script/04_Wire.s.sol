// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Deployments} from "./Deployments.sol";
import {console2} from "forge-std/Script.sol";
import {PolicyHook} from "../src/PolicyHook.sol";
import {MandatePolicy} from "../src/policies/MandatePolicy.sol";
import {IPolicy} from "../src/interfaces/IPolicy.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {StateLibrary} from "v4-core/libraries/StateLibrary.sol";

/// Final wiring pass. Deploys nothing new:
///   - initialize the pool with PolicyHook attached
///   - PolicyHook.setPolicy(poolId, MandatePolicy)
///   - MandatePolicy.amend(mandateHash + covenants from mandates/fund-one.yaml)
///
/// The mandate hash is read from `mandate.compiled.json`, which
/// `make mandate-compile` produces from the YAML. It is deliberately NOT typed
/// into this script: the hash the on-chain covenants are amended to has to be
/// the hash of the document the Validator and the journal agree on, and the
/// only way to guarantee that is to derive all three from one file.
contract Wire is Deployments {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    uint24 internal constant FEE = 3000;
    int24 internal constant TICK_SPACING = 60;

    /// @dev 2^96. v4 prices are sqrt(amount1/amount0) in RAW token units.
    uint160 internal constant Q96 = 79228162514264337593543950336;

    /// @dev The quote is 6dp and the asset 18dp, so "one token is worth one
    ///      token" is a raw-unit ratio of 1e12, not 1. Initializing at 1:1 —
    ///      which is what every v4 example does, because their examples pair
    ///      two 18dp tokens — makes the pool believe one micro-USDC is worth
    ///      one wei of the asset. The swap then disagrees with the Chainlink
    ///      price by twelve orders of magnitude, so the covenants are measured
    ///      against a portfolio that has nothing to do with what trades.
    ///      10^6 = sqrt(10^12).
    uint256 internal constant DECIMAL_GAP_SQRT = 1e6;

    function run() external {
        address poolManager = _requireAddr(".contracts.PoolManager");
        address hookAddr = _requireAddr(".contracts.PolicyHook");
        address policyAddr = _requireAddr(".contracts.MandatePolicy");
        address usdc = _requireAddr(".contracts.MockUSDC");
        address asset = _requireAddr(".contracts.MockAsset");

        // v4 requires currency0 < currency1. Which side the quote lands on is
        // therefore an accident of address ordering, and the covenant maths
        // needs to know — see MandatePolicy.quoteIsCurrency0.
        (address c0, address c1) = usdc < asset ? (usdc, asset) : (asset, usdc);
        bool quoteIsCurrency0 = (c0 == usdc);

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(c0),
            currency1: Currency.wrap(c1),
            fee: FEE,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(hookAddr)
        });
        PoolId poolId = key.toId();

        // --- the mandate, from the YAML via mandate.compiled.json ----------
        string memory m = vm.readFile("./mandate.compiled.json");
        bytes32 mandateHash = vm.parseJsonBytes32(m, ".hash");
        // The compiler emits covenants as decimal STRINGS, because two of them
        // are uint256 values that do not survive a JSON number.
        uint256 maxPositionBps = vm.parseUint(vm.parseJsonString(m, ".covenants.maxPositionBps"));
        uint256 minCashBps = vm.parseUint(vm.parseJsonString(m, ".covenants.minCashBps"));
        uint256 maxTradeNotional = vm.parseUint(vm.parseJsonString(m, ".covenants.maxTradeNotional"));
        uint256 maxDailyNotional = vm.parseUint(vm.parseJsonString(m, ".covenants.maxDailyNotional"));

        // Re-runnable on purpose: amending the mandate means re-running this
        // script, and by then the pool exists. The check has to happen OUTSIDE
        // the broadcast — under startBroadcast every external call is queued as
        // a transaction, so a try/catch around a reverting initialize still
        // leaves an un-broadcastable tx and fails the whole script.
        // price = amount1 / amount0 in raw units.
        //   quote is currency0 -> asset per quote = 1e18/1e6 = 1e12
        //   quote is currency1 -> quote per asset = 1e6/1e18 = 1e-12
        uint160 startPrice = quoteIsCurrency0
            ? uint160(uint256(Q96) * DECIMAL_GAP_SQRT)
            : uint160(uint256(Q96) / DECIMAL_GAP_SQRT);

        (uint160 existingPrice,,,) = IPoolManager(poolManager).getSlot0(poolId);
        bool needsInit = existingPrice == 0;

        uint256 pk = _deployerKey();
        vm.startBroadcast(pk);

        if (needsInit) {
            IPoolManager(poolManager).initialize(key, startPrice);
            console2.log("pool initialized");
        } else {
            console2.log("pool already initialized - re-wiring only");
        }
        PolicyHook(hookAddr).setPolicy(poolId, IPolicy(policyAddr));
        MandatePolicy(policyAddr).amend(
            mandateHash, maxPositionBps, minCashBps, maxTradeNotional, maxDailyNotional, quoteIsCurrency0
        );

        vm.stopBroadcast();

        _writeBytes32(".pool.poolId", PoolId.unwrap(poolId));
        _writeAddr(".pool.currency0", c0);
        _writeAddr(".pool.currency1", c1);
        vm.writeJson(quoteIsCurrency0 ? "true" : "false", _path(), ".pool.quoteIsCurrency0");

        console2.log("mandateHash", vm.toString(mandateHash));
        console2.log("quoteIsCurrency0", quoteIsCurrency0);
    }
}
