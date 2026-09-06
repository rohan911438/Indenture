// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Deployers} from "@uniswap/v4-core/test/utils/Deployers.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId} from "v4-core/types/PoolId.sol";
import {Currency} from "v4-core/types/Currency.sol";

import {PolicyHook} from "../../src/PolicyHook.sol";
import {MandatePolicy} from "../../src/policies/MandatePolicy.sol";
import {IndentureVault} from "../../src/IndentureVault.sol";
import {ReceiptLib} from "../../src/libs/ReceiptLib.sol";

/// @notice Shared fixture: a real PoolManager, a real pool with liquidity, the
///         hook at a correctly-mined address, MandatePolicy registered for the
///         pool, and a funded IndentureVault.
///
/// @dev    Everything here runs on anvil — 90% of testing is meant to, and none
///         of it needs testnet HBAR. The Validator is impersonated by
///         `VALIDATOR_PK` (anvil account #0), the same key the TypeScript
///         signer uses in `packages/receipt`, so a receipt produced here and a
///         receipt produced by the Worker are interchangeable.
abstract contract IndentureTest is Deployers {
    /// anvil account #0 — matches packages/receipt fixtures and the Worker's
    /// mock VALIDATOR_KEY.
    uint256 internal constant VALIDATOR_PK =
        0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    address internal validatorSigner;

    /// A second key, for "what happens when someone else signs".
    uint256 internal constant ROGUE_PK =
        0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;
    address internal rogueSigner;

    address internal fundOwner = makeAddr("fundOwner");
    address internal fundManager = makeAddr("fundManager");

    PolicyHook internal hook;
    MandatePolicy internal policy;
    IndentureVault internal vault;

    PoolKey internal poolKey;
    PoolId internal poolId;

    bytes32 internal constant MANDATE_HASH = keccak256("fund-one/v1");

    // Covenant limits used by the fixture. Sprint 2 enforces these on-chain;
    // Sprint 1 only needs them present so `amend()` has something to write.
    uint256 internal constant MAX_POSITION_BPS = 3000;
    uint256 internal constant MIN_CASH_BPS = 1000;
    // Sized in wei of the fixture's 18dp currencies, generously above the
    // trades the happy-path tests make, so only the tests that mean to breach
    // a cap do so.
    uint256 internal constant MAX_TRADE_NOTIONAL = 100e18;
    uint256 internal constant MAX_DAILY_NOTIONAL = 500e18;

    /// The fixture treats currency1 as the quote (cash) side.
    bool internal constant QUOTE_IS_CURRENCY0 = false;

    function setUp() public virtual {
        validatorSigner = vm.addr(VALIDATOR_PK);
        rogueSigner = vm.addr(ROGUE_PK);

        deployFreshManagerAndRouters();
        (currency0, currency1) = deployMintAndApprove2Currencies();

        _deployHookAtMinedAddress();

        vm.prank(fundOwner);
        policy = new MandatePolicy(fundOwner, address(hook), validatorSigner);

        vm.prank(fundOwner);
        policy.amend(MANDATE_HASH, MAX_POSITION_BPS, MIN_CASH_BPS, MAX_TRADE_NOTIONAL, MAX_DAILY_NOTIONAL, QUOTE_IS_CURRENCY0);

        (poolKey,) = initPoolAndAddLiquidity(currency0, currency1, IHooks(address(hook)), 3000, SQRT_PRICE_1_1);
        poolId = poolKey.toId();

        vm.prank(fundOwner);
        hook.setPolicy(poolId, policy);

        vault = new IndentureVault(fundOwner, manager, fundManager);

        vm.prank(fundOwner);
        policy.setVault(address(vault));

        // Fund the vault on both sides so either direction can settle.
        deal(Currency.unwrap(currency0), address(vault), 1_000_000e18);
        deal(Currency.unwrap(currency1), address(vault), 1_000_000e18);
    }

    /// @dev The hook address must encode exactly beforeSwap|afterSwap in its
    ///      low 14 bits, or PoolManager's `validateHookAddress` rejects the
    ///      pool at initialize. In tests we place the code directly rather than
    ///      grinding a CREATE2 salt — `script/02_Hook.s.sol` does the real
    ///      mining for deploys, and `Hook.t.sol` proves the miner agrees with
    ///      what PoolManager will accept.
    function _deployHookAtMinedAddress() private {
        uint160 flags = uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG);
        address target = address((uint160(0x4444) << 144) | flags);
        deployCodeTo("PolicyHook.sol:PolicyHook", abi.encode(manager, fundOwner), target);
        hook = PolicyHook(target);
    }

    // ---------------------------------------------------------------------
    // Receipt helpers
    // ---------------------------------------------------------------------

    function _receipt(IPoolManager.SwapParams memory params, uint64 seq)
        internal
        view
        returns (ReceiptLib.Receipt memory)
    {
        return ReceiptLib.Receipt({
            mandateHash: MANDATE_HASH,
            poolId: PoolId.unwrap(poolId),
            paramsHash: keccak256(abi.encode(params)),
            seq: seq,
            deadline: uint64(block.timestamp + 120),
            vault: address(vault)
        });
    }

    /// @dev abi.encode(Receipt, signature) — the exact blob the Manager
    ///      forwards as v4 hookData.
    function _blob(ReceiptLib.Receipt memory r, uint256 pk) internal view returns (bytes memory) {
        bytes32 d = ReceiptLib.digest(r, policy.domainSeparator());
        (uint8 v, bytes32 rr, bytes32 s) = vm.sign(pk, d);
        return abi.encode(r, abi.encodePacked(rr, s, v));
    }

    /// @dev The common case: a well-formed receipt for `params`, signed by the
    ///      registered Validator, at the vault's current expected sequence.
    function _signedFor(IPoolManager.SwapParams memory params) internal view returns (bytes memory) {
        return _blob(_receipt(params, policy.seqOf(address(vault))), VALIDATOR_PK);
    }

    /// @dev A receipt naming an arbitrary vault / seq / signer, for the tests
    ///      that need one of those to be wrong.
    function _blobFor(address forVault, IPoolManager.SwapParams memory params, uint64 seq, uint256 pk)
        internal
        view
        returns (bytes memory)
    {
        ReceiptLib.Receipt memory r = _receipt(params, seq);
        r.vault = forVault;
        return _blob(r, pk);
    }

    function _sellParams(int256 amount) internal pure returns (IPoolManager.SwapParams memory) {
        return IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: amount,
            sqrtPriceLimitX96: MIN_PRICE_LIMIT
        });
    }

    function _buyParams(int256 amount) internal pure returns (IPoolManager.SwapParams memory) {
        return IPoolManager.SwapParams({
            zeroForOne: false,
            amountSpecified: amount,
            sqrtPriceLimitX96: MAX_PRICE_LIMIT
        });
    }

    function _trade(IPoolManager.SwapParams memory params, bytes memory blob) internal {
        vm.prank(fundManager);
        vault.trade(poolKey, params, blob);
    }

    /// @dev Call MandatePolicy the way PolicyHook does, so a named revert
    ///      surfaces directly. Going through the vault instead would wrap the
    ///      error in PoolManager's WrappedError and lose the selector — and the
    ///      project rule is that every named error gets its own test.
    ///      Router.t.sol covers the full integration path.
    function _callPolicy(IPoolManager.SwapParams memory params, bytes memory blob) internal {
        vm.prank(address(hook));
        policy.beforeSwap(address(vault), poolId, poolKey, params, blob);
    }

    /// @dev A receipt signed under a different EIP-712 domain (e.g. another
    ///      chainId), which must fail to recover to the registered signer.
    function _blobForeignDomain(IPoolManager.SwapParams memory params, uint256 chainId)
        internal
        view
        returns (bytes memory)
    {
        ReceiptLib.Receipt memory r = _receipt(params, policy.seqOf(address(vault)));
        bytes32 d = ReceiptLib.digest(r, ReceiptLib.domainSeparator(chainId, address(policy)));
        (uint8 v, bytes32 rr, bytes32 ss) = vm.sign(VALIDATOR_PK, d);
        return abi.encode(r, abi.encodePacked(rr, ss, v));
    }
}
