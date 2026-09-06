// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title  HookMiner
/// @notice Finds a CREATE2 salt that puts a hook at an address whose low 14
///         bits are exactly the permission flags it declares.
///
/// @dev    v4 encodes hook permissions in the address itself, so a hook cannot
///         be deployed anywhere convenient — the salt has to be ground for.
///         `PoolManager.initialize` rejects a pool whose hook address does not
///         match `getHookPermissions()`, and `BaseHook`'s constructor rejects it
///         at deploy time, so getting this wrong costs a failed deployment.
///         On Hedera that is scarce testnet HBAR, which is why this is mined and
///         asserted in a test before any deploy script runs.
///
///         CREATE2 is available on Hedera (HIP-329, since Services v0.23) and
///         computes the EIP-1014 address exactly as on any other EVM chain.
library HookMiner {
    /// @dev v4 uses the low 14 bits; see Hooks.ALL_HOOK_MASK.
    uint160 internal constant FLAG_MASK = uint160((1 << 14) - 1);

    /// @dev Give up rather than spin forever. ~160k is far beyond what is
    ///      needed for a 14-bit target in practice.
    uint256 internal constant MAX_LOOP = 160_000;

    error SaltNotFound(uint160 targetFlags);

    /// @param deployer      the CREATE2 deployer that will send the deployment
    /// @param flags         the desired low-14-bit pattern (e.g. BEFORE_SWAP | AFTER_SWAP)
    /// @param creationCode  `type(MyHook).creationCode`
    /// @param constructorArgs abi.encode(...) of the constructor arguments
    /// @return hookAddress  the address the hook will land at
    /// @return salt         the salt that produces it
    function find(address deployer, uint160 flags, bytes memory creationCode, bytes memory constructorArgs)
        internal
        pure
        returns (address hookAddress, bytes32 salt)
    {
        bytes32 initCodeHash = keccak256(abi.encodePacked(creationCode, constructorArgs));

        for (uint256 i = 0; i < MAX_LOOP; i++) {
            salt = bytes32(i);
            hookAddress = computeAddress(deployer, salt, initCodeHash);
            if (uint160(hookAddress) & FLAG_MASK == flags) return (hookAddress, salt);
        }
        revert SaltNotFound(flags);
    }

    /// @dev Standard EIP-1014 address derivation.
    function computeAddress(address deployer, bytes32 salt, bytes32 initCodeHash)
        internal
        pure
        returns (address)
    {
        return address(
            uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), deployer, salt, initCodeHash))))
        );
    }
}
