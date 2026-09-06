// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";

/// @notice Read/write access to `contracts/deployments.json`, which is the
///         single source of truth for every address and topic id in the system.
///
/// @dev    The rule from README.md is "never read an address from an env var".
///         This base class is what makes that practical: every script reads its
///         inputs from the file and writes its outputs back, so the deploy order
///         is enforced by data rather than by remembering to export the right
///         variables in the right shell.
///
///         Addresses start as `""` in the committed file, which is not parseable
///         as an address — `_readAddr` treats that as "not deployed yet" and
///         `_requireAddr` turns it into a named failure. That is deliberate: on
///         Hedera a mis-ordered deploy costs scarce testnet HBAR, so a script
///         that would run against a half-populated file should refuse before it
///         broadcasts anything, not after.
abstract contract Deployments is Script {
    /// @dev Defaults to the committed testnet file. `make deploy-local` points
    ///      it at deployments.local.json (gitignored) so a free anvil rehearsal
    ///      cannot overwrite the real addresses — the deploy sequence gets
    ///      practised end to end without touching the source of truth.
    function _path() internal view returns (string memory) {
        try vm.envString("DEPLOYMENTS_PATH") returns (string memory p) {
            return p;
        } catch {
            return "./deployments.json";
        }
    }

    function _json() internal view returns (string memory) {
        return vm.readFile(_path());
    }

    /// @return the address at `key`, or address(0) if the slot is still empty
    function _readAddr(string memory key) internal view returns (address) {
        string memory raw = vm.parseJsonString(_json(), key);
        if (bytes(raw).length != 42) return address(0);
        return vm.parseAddress(raw);
    }

    function _requireAddr(string memory key) internal view returns (address a) {
        a = _readAddr(key);
        if (a == address(0)) {
            console2.log("deployments.json is missing", key);
            revert("run the earlier deploy step first");
        }
    }

    function _writeAddr(string memory key, address value) internal {
        vm.writeJson(vm.toString(value), _path(), key);
        console2.log(key, vm.toString(value));
    }

    function _writeUint(string memory key, uint256 value) internal {
        vm.writeJson(vm.toString(value), _path(), key);
        console2.log(key, value);
    }

    function _writeBytes32(string memory key, bytes32 value) internal {
        vm.writeJson(vm.toString(value), _path(), key);
        console2.log(key, vm.toString(value));
    }

    /// @dev The deployer. On testnet this is HEDERA_OPERATOR_KEY; on anvil the
    ///      Makefile passes account #0 so the whole pipeline can be rehearsed
    ///      for free before it is run for real.
    function _deployerKey() internal view returns (uint256) {
        return vm.envUint("DEPLOYER_KEY");
    }
}
