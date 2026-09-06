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

    uint24 internal constant FEE = 3000;
    int24 internal constant TICK_SPACING = 60;
    /// 1:1 starting price. sqrt(1) * 2^96.
    uint160 internal constant SQRT_PRICE_1_1 = 79228162514264337593543950336;

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

        uint256 pk = _deployerKey();
        vm.startBroadcast(pk);

        IPoolManager(poolManager).initialize(key, SQRT_PRICE_1_1);
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
