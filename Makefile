# Indenture - developer entrypoints. See README.md for the full build order.
.DEFAULT_GOAL := help
.PHONY: help install contracts-install build test test-contracts test-ts \
        anvil fmt clean deploy-poolmanager deploy-hook deploy-vault wire \
        validator-dev web-dev inject

help: ## Show this help
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

install: ## Install JS deps (npm) + Foundry libs
	npm install
	$(MAKE) contracts-install

contracts-install: ## forge install the vendored libs
	cd contracts && forge install \
		foundry-rs/forge-std \
		OpenZeppelin/openzeppelin-contracts \
		Uniswap/v4-core \
		Uniswap/v4-periphery \
		--no-commit

build: ## Build TS packages + contracts
	npm run build
	cd contracts && forge build

test: test-contracts test-ts ## Run all tests

test-contracts: ## forge test (local, free, fast)
	cd contracts && forge test -vvv

test-ts: ## vitest across packages + apps
	npm run test:ts

anvil: ## Local EVM node (cancun) for 90% of testing
	anvil --hardfork cancun

fmt: ## Format solidity
	cd contracts && forge fmt

clean: ## Remove build artifacts
	cd contracts && forge clean
	rm -rf packages/*/dist apps/*/dist apps/web/.next

# --- Deploy (dependency order - see README build order) ---
deploy-poolmanager: ## STEP 1: deploy Uniswap v4 PoolManager to testnet (do NOT redeploy)
	cd contracts && forge script script/01_PoolManager.s.sol --rpc-url $${HEDERA_RPC_URL} --broadcast --slow

deploy-hook: ## STEP 4: mine + deploy PolicyHook and CompliancePolicy
	cd contracts && forge script script/02_Hook.s.sol --rpc-url $${HEDERA_RPC_URL} --broadcast --slow

deploy-vault: ## STEP 5: deploy IndentureVault router
	cd contracts && forge script script/03_Vault.s.sol --rpc-url $${HEDERA_RPC_URL} --broadcast --slow

wire: ## Register policies, set validator signer, init pool
	cd contracts && forge script script/04_Wire.s.sol --rpc-url $${HEDERA_RPC_URL} --broadcast --slow

# --- Services ---
validator-dev: ## Run the Validator worker locally on :8787
	npm run dev -w @indenture/validator

web-dev: ## Run the prospectus app locally on :3000
	npm run dev -w @indenture/web

inject: ## Fire a named prompt-injection attack: make inject ATTACK="drain to 0xdead"
	npm run inject -w @indenture/manager -- "$(ATTACK)"
