# Indenture

**Compliance-enforced, AI-managed investment fund on Hedera testnet.**
ETHOnline 2026 · Hedera testnet (chainId 296) · $0 cash cost.

Indenture is a compliance-enforced, AI-managed investment fund on Hedera. An
untrusted AI agent (the Manager) proposes trades; a separate Validator service
independently re-derives all facts from source (mirror node, chain state,
Chainlink price) and cryptographically signs only trades that satisfy the
fund's mandate — or refuses. A final on-chain Uniswap v4 hook re-checks fixed
covenants before any swap executes, so even a fully compromised AI, or a
compromised Validator signature, cannot move funds outside the mandate. Every
approval and every refusal is permanently journaled to Hedera Consensus
Service, making blocked attacks a visible, auditable part of the product — not
a hidden failure.

## Five non-negotiable design rules

1. **The mirror node is the only database.** No Postgres/Supabase. No indexer.
2. **The Validator's input is EXACTLY `{poolId, swapParams}`**, parsed with a
   Zod `.strict()` schema that rejects unknown keys. It fetches everything else
   itself (mandate, pool state, price feed). Free text from the Manager must
   never reach the Validator.
3. **The hook trusts a registered signer address, verified via `ecrecover`** —
   this source is pluggable (service today, Chainlink DON report later; no
   contract changes needed for the swap).
4. **The on-chain hook makes zero external calls, zero oracle reads, zero
   unbounded loops.** It only compares fixed-width values already in storage.
   All liveness/staleness judgment happens off-chain in the Validator, which
   can simply refuse to sign.
5. **Runtime placement follows ONE constraint:** anything that writes to Hedera
   Consensus Service (HCS) needs gRPC over HTTP/2 via `@hashgraph/sdk`, which
   only runs on Node — never on an edge runtime. Everything else (pure HTTP)
   runs on Cloudflare Workers or is static.

## Topology

| App | Runtime | Trust | Role |
|---|---|---|---|
| `apps/manager` | Node, GitHub Actions cron | **untrusted by design** | Calls an LLM behind `Proposer{propose(state):Proposal}`, with a `RuleProposer` arithmetic fallback for quota outages. |
| `apps/validator` | Cloudflare Worker (Hono + Zod) | holds `VALIDATOR_KEY` | Signs EIP-712 receipts with viem, never ethers. |
| `apps/journaler` | Node, cron + local watch | — | Writes `Executed` / `BreachObserved` events to the journal HCS topic via `@hashgraph/sdk`. |
| `apps/web` | Next.js 15 / React 19 on Vercel | — | 4 routes, zero API routes, reads only from mirror node + RPC + wagmi. |

## Contracts (Foundry, deploy order matters)

| # | Contract | Role |
|---|---|---|
| C1 | `PoolManager.sol` | Uniswap v4-core, **unmodified**, deployed once. |
| C2 | `PolicyHook.sol` | `BaseHook`, `mapping(PoolId => IPolicy)`, delegates to whichever policy is registered for that pool. |
| C3 | `CompliancePolicy.sol` | checks `identityRegistry.isVerified` + `compliance.canTransfer`. |
| C4 | `MandatePolicy.sol` | verifies EIP-712 receipt, binds hash+seq+paramsHash, runs 4 integer covenant checks, owner-only `amend()`. |
| C5 | `IndentureVault.sol` | the fund; its own router; `unlock`/`swap`/`sync`/`settle`/`take`; has an unconditional `emergencyExit` outside any policy. |
| C6 | ATS suite | ERC-3643 Security + IdentityRegistry + ModularCompliance, deployed via `@hashgraph/asset-tokenization-sdk`, **NOT hand-rolled**. |
| C7 | `MandateComplianceModule.sol` | `canTransfer()` reads `MandatePolicy.inBreach()`; a portfolio breach freezes the share class. |
| C8 | `MockUSDC.sol` + existing Chainlink `AggregatorV3Interface` (read-only, don't deploy the feed). |

## Data model (freeze on day 2)

- **HCS envelope:** `{v, type: MANDATE|RECEIPT|BREACH|CONTEXT, vault, ts, body}`
- **`deployments.json`** is the single source of truth for every address/topic
  ID — never read an address from an env var.
- **`packages/receipt`** is the seam: the EIP-712 struct must be byte-identical
  between the TypeScript signer and the Solidity verifier. Write
  `test_SignedInTypescript_RecoversInSolidity` FIRST, before anything else
  depends on it.

## Build order (dependency order, not calendar order)

1. Deploy `PoolManager` to Hedera testnet — biggest unknown, do this first.
2. Deploy + verify ATS ERC-3643 token in parallel (independent).
3. Freeze `packages/receipt` + passing sig-recovery vector.
4. `PolicyHook` + `CompliancePolicy` (qualifies for the Hedera track alone).
5. `IndentureVault` router (test entirely on anvil).
6. Deploy Validator Worker (ship the URL early, even half-working).
7. `MandatePolicy` (signature + binding first, covenants second).
8. First end-to-end: proposal → receipt → vault → swap → event.
9. Journaler + `MandateComplianceModule` breach cross-link.
10. Adversarial harness: `npm run inject "<attack string>"` + 3 named injections
    + an unprotected control vault that loses money on purpose (for contrast).
11. Prospectus app — build `/blocked` FIRST, it's the demo's main stage.

## Layout

```
indenture/
├─ contracts/                      foundry
│  ├─ src/{PolicyHook,IndentureVault}.sol
│  │  ├─ interfaces/IPolicy.sol
│  │  ├─ policies/{CompliancePolicy,MandatePolicy}.sol
│  │  ├─ compliance/MandateComplianceModule.sol
│  │  ├─ libs/ReceiptLib.sol
│  │  └─ mocks/MockUSDC.sol
│  ├─ script/  01_PoolManager · 02_Hook · 03_Vault · 04_Wire
│  ├─ test/    Compliance · Mandate · Replay · Router · Adversarial
│  ├─ foundry.toml
│  └─ deployments.json             single source of truth for addresses
├─ packages/{receipt,mandate,hedera}/
├─ apps/{manager,validator,journaler,web}/
├─ mandates/fund-one.yaml
├─ Makefile
└─ .github/workflows/  ci.yml · agent-tick.yml · journaler.yml
```

## Getting started

```bash
# 1. tooling
#   - Node 22+ with npm 9+ (npm workspaces; see .nvmrc)
#   - Foundry (curl -L https://foundry.paradigm.xyz | bash && foundryup)

make install          # npm install + forge install
cp .env.example .env   # fill in keys (see secrets table below)

make build            # build TS packages + contracts
make test             # forge test + vitest

make anvil            # local EVM node (cancun) in another shell
make validator-dev    # Validator worker on :8787
make web-dev          # prospectus app on :3000
```

## Testing

90% on local anvil (free, instant). Testnet only for integration + the final
demo run. Every named revert error gets its own Foundry test.

## Secrets & blast radius

| Secret | Lives in | Blast radius |
|---|---|---|
| `VALIDATOR_KEY` | Wrangler secret | **high** — never in repo/browser |
| `ISSUER_KEY` | offline laptop only | high — never in CI |
| `MANAGER_KEY` | GitHub secret | **low by design** — assume it's stolen |
| `HEDERA_OPERATOR` | GitHub secret | testnet only |
| `LLM_API_KEY` | free tier | none |

## The one scarce resource

Testnet HBAR. Bank it daily (refill all portal accounts every morning), never
redeploy `PoolManager`, and estimate gas without `--broadcast` before every
real deploy.
