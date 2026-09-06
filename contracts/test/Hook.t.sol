// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Deployers} from "@uniswap/v4-core/test/utils/Deployers.sol";
import {HookMiner} from "../src/libs/HookMiner.sol";
import {PolicyHook} from "../src/PolicyHook.sol";
import {BaseHook} from "../src/base/BaseHook.sol";
import {IPolicy} from "../src/interfaces/IPolicy.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {PoolId} from "v4-core/types/PoolId.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";

/// The hook address is load-bearing: v4 reads permissions out of the low 14
/// bits, so a mis-mined address is a failed deployment. On Hedera that costs
/// scarce testnet HBAR, so the miner is proven here before any deploy script
/// spends anything.
contract HookTest is Deployers {
    /// The canonical CREATE2 deployer, present on Hedera via HIP-329. This is
    /// what `script/02_Hook.s.sol` mines against, because Foundry routes salted
    /// deployments through it under `--broadcast`.
    address internal constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    /// @dev In a test, `new X{salt: s}` is a CREATE2 from THIS contract, not
    ///      from the deterministic deployer — so that is what must be mined
    ///      against here. Mining against the wrong deployer is exactly the
    ///      mistake this suite exists to catch before it costs testnet HBAR.
    function _deployer() internal view returns (address) {
        return address(this);
    }

    function setUp() public {
        deployFreshManagerAndRouters();
    }

    function test_MinedAddress_EncodesExactlyBeforeAndAfterSwap() public {
        uint160 flags = uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG);

        (address mined, bytes32 salt) = HookMiner.find(
            _deployer(), flags, type(PolicyHook).creationCode, abi.encode(manager, address(this))
        );

        assertEq(uint160(mined) & HookMiner.FLAG_MASK, flags, "mined address has the wrong flag bits");
        assertEq(uint160(mined) & HookMiner.FLAG_MASK, 0xC0, "beforeSwap|afterSwap is 0xC0");

        // Deploying at that salt must land exactly where the miner predicted.
        PolicyHook deployed = new PolicyHook{salt: salt}(manager, address(this));
        assertEq(address(deployed), mined, "CREATE2 landed somewhere other than predicted");
    }

    function test_MinedHook_IsAcceptedByPoolManager() public {
        // The real acceptance test: PoolManager.initialize validates the hook
        // address against getHookPermissions(). If the miner and the permission
        // struct ever disagree, this is where it shows up.
        uint160 flags = uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG);
        (, bytes32 salt) = HookMiner.find(
            _deployer(), flags, type(PolicyHook).creationCode, abi.encode(manager, address(this))
        );
        PolicyHook h = new PolicyHook{salt: salt}(manager, address(this));

        (currency0, currency1) = deployMintAndApprove2Currencies();
        initPool(currency0, currency1, IHooks(address(h)), 3000, SQRT_PRICE_1_1);
    }

    function test_WrongAddress_RejectedAtConstruction() public {
        // A hook deployed to an address that does not encode its permissions
        // must fail immediately, not at the first swap. `new` without a salt
        // lands at a CREATE address that will not match 0xC0.
        vm.expectRevert();
        new PolicyHook(manager, address(this));
    }

    function test_HookCallbacks_RejectDirectCalls() public {
        uint160 flags = uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG);
        (, bytes32 salt) = HookMiner.find(
            _deployer(), flags, type(PolicyHook).creationCode, abi.encode(manager, address(this))
        );
        PolicyHook h = new PolicyHook{salt: salt}(manager, address(this));

        // `sender` is attacker-controlled if anyone can call the hook directly,
        // which would let a caller impersonate the vault to the policy.
        IPoolManager.SwapParams memory p =
            IPoolManager.SwapParams({zeroForOne: true, amountSpecified: -1, sqrtPriceLimitX96: MIN_PRICE_LIMIT});

        vm.expectRevert(BaseHook.NotPoolManager.selector);
        h.beforeSwap(address(this), key, p, "");
    }

    function test_UndeclaredCallback_Reverts_HookNotImplemented() public {
        uint160 flags = uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG);
        (, bytes32 salt) = HookMiner.find(
            _deployer(), flags, type(PolicyHook).creationCode, abi.encode(manager, address(this))
        );
        PolicyHook h = new PolicyHook{salt: salt}(manager, address(this));

        // PolicyHook declares no donate permission, so the inherited default
        // must refuse rather than silently succeed.
        vm.expectRevert(BaseHook.HookNotImplemented.selector);
        h.beforeDonate(address(this), key, 0, 0, "");
    }
}
