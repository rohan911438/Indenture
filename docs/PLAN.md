# Indenture — delivery plan

Sprints are **dependency-ordered, not calendar-ordered**. Each has a single exit
criterion that is a command you can run. Nothing is "done" because it was
written; it is done when its test is green.

The backlog is largely already written: `contracts/test/` contains **29 skipped
Foundry tests** with precise names. Most of this plan is un-skipping them in the
right order. That is the definition of done for the contract track.

Findings driving this plan are in [RESEARCH.md](RESEARCH.md).

---

## Status board

| Sprint | Theme | Exit criterion | State |
|---|---|---|---|
| 0 | Toolchain | clean clone builds + tests | ✅ done |
| 1 | On-chain spine | `Router.t.sol`, `Replay.t.sol`, sig/binding half of `Mandate.t.sol` green | ⬜ |
| 2 | Covenants enforced | `Mandate.t.sol` + `Adversarial.t.sol` fully green | ⬜ |
| 3 | Compliance | `Compliance.t.sol` green | ⬜ |
| 4 | Real data | Validator + journaler off mocks, `mock-status.md` rows 3–8 closed | ⬜ |
| 5 | Testnet | `deployments.json` fully populated, one real trade | ⬜ |
| 6 | Frontend live | `lib/data.ts` reads chain, 4 routes render real data | ⬜ |
| 7 | Demo | injection → refusal → journal, on testnet, repeatable | ⬜ |

---

## Sprint 0 — Toolchain ✅

Done 2026-09-06, commit `0c88932`.

The repo had never been compiled. Four solc errors and three reproducibility
problems fixed; see the commit message. Baseline now:

```
forge build      clean
forge test       5 passed, 29 skipped
npm run test:ts  16 files, all pass
npm run typecheck clean
next build       4 routes
```

**The 5 passing tests are `Receipt.t.sol`** — the cross-language EIP-712 seam.
That is the correct thing to have working first and it is working.

---

## Sprint 1 — The on-chain spine

**Goal:** a real Uniswap v4 swap, through a real hook, authorised by a real
signed receipt, on anvil. No covenants yet — just the plumbing that everything
else hangs off.

Why first: `MandatePolicy`'s covenant logic is meaningless until a swap can
actually reach it, and the `paramsHash` binding (RESEARCH §2.4) can only be
proven correct by going through a live `PoolManager`.

| # | Task | Notes |
|---|---|---|
| 1.1 | `IPolicy` takes decoded `SwapParams`, not `bytes` | RESEARCH §2.4 — kills a whole class of encoding drift |
| 1.2 | `PolicyHook extends BaseHook` | `getHookPermissions` = beforeSwap + afterSwap only; `onlyPoolManager`; adapt v4's 3-value return so policies keep the narrow `bytes4` contract (§2.5) |
| 1.3 | `HookMiner` + `02_Hook.s.sol` mines an address with `& 0xFF == 0xC0` | CREATE2, confirmed available on Hedera (§1.2) |
| 1.4 | `MandatePolicy` sig + binding path finished | recover → deadline → vault → mandateHash → seq → paramsHash. Logic is 90% written; needs the new params type |
| 1.5 | `IndentureVault` router | `unlock` / `unlockCallback` / `swap` / `sync` / `settle` / `take`; emits `Executed`; `onlyManager` on `trade()`; `emergencyExit` outside all policy |
| 1.6 | Un-skip `Router.t.sol` (6), `Replay.t.sol` (3), and the sig/binding tests in `Mandate.t.sol` (5) | |

**Exit:** `forge test` = 19 passed, 15 skipped. The 15 remaining are the 4
covenant tests, `Amend_OnlyOwner`, `Adversarial.t.sol`, and `Compliance.t.sol`.

**Watch for:** the `paramsHash` equality is the risky one. Assert it explicitly
in `Router.t.sol` against a receipt signed by the *TypeScript* signer, not one
re-encoded in Solidity — otherwise the test proves nothing (§2.4).

---

## Sprint 2 — Covenants actually enforced

**Goal:** close the gap between the pitch and the code. Today a valid signature
authorises any trade (RESEARCH §2.3).

The design problem to solve first: **design rule 4 forbids the hook from making
external calls**, so `beforeSwap` cannot read vault balances or a price feed to
learn the post-trade position. The values must already be in `MandatePolicy`
storage when the hook runs.

**Decision to make in 2.1 (do this before writing code):** the vault writes a
portfolio snapshot to `MandatePolicy` in the same transaction, before calling
`PoolManager.swap`. The hook then compares fixed-width integers already in
storage — no calls, no oracles, no loops, exactly as specified. The snapshot is
untrusted (the vault is the thing being constrained), so the receipt must bind
the snapshot too, or a compromised manager could write a flattering snapshot and
then trade against it. Binding the snapshot hash into the receipt is the clean
answer and costs one more field.

> This changes the EIP-712 Receipt struct, which breaks the frozen seam. If
> taken, `packages/receipt/src/types.ts`, `ReceiptLib.sol`, the vector, and
> `shared-contracts/validator-api.md` all change **in one commit**, and
> `Receipt.t.sol` must go green again before anything else proceeds.

| # | Task |
|---|---|
| 2.1 | Decide + document the snapshot binding; update the receipt seam in one commit if it changes |
| 2.2 | 4 integer covenant checks in `beforeSwap` — max position, min cash, per-trade notional, rolling daily notional |
| 2.3 | `BreachObserved` emitted from `afterSwap`; `inBreach()` becomes real |
| 2.4 | Un-skip the 4 covenant tests + `Amend_OnlyOwner` |
| 2.5 | Adversarial harness: `npm run inject "<attack>"` + 3 named injections |
| 2.6 | Unprotected control vault that loses money on purpose (the contrast shot) |

**Exit:** `Mandate.t.sol` 11/11, `Adversarial.t.sol` green. Every named revert
error has its own test — that is a stated project rule.

---

## Sprint 3 — Compliance (ERC-3643)

| # | Task |
|---|---|
| 3.1 | `CompliancePolicy`: `isVerified` + `canTransfer`, emits `ComplianceRefused` |
| 3.2 | Deploy ATS suite via `@hashgraph/asset-tokenization-sdk` (§1.4) — **not** hand-rolled |
| 3.3 | `MandateComplianceModule.canTransfer()` reads `MandatePolicy.inBreach()` — a portfolio breach freezes the share class |
| 3.4 | Un-skip `Compliance.t.sol` (4) |

**Exit:** `forge test` fully green, 34/34. This sprint alone qualifies for the
Hedera track.

**Note:** 3.2 needs a real network — it is the first task that cannot be done
offline. Keep it isolated behind the two view functions so nothing else blocks
on it.

---

## Sprint 4 — Real data

Swap the mocks. `shared-contracts/mock-status.md` is the checklist; this sprint
closes rows 3–8.

| # | Task |
|---|---|
| 4.1 | **Fix the staleness trap** — `feedStaleAfterSec` into the mandate YAML + compiler, default `90000`. RESEARCH §2.1. Do this first; it is a one-line bug that would have killed the demo |
| 4.2 | Fix the KV nonce lock: acquire on the approval path only, release on refusal (§2.6) |
| 4.3 | `MirrorSources`: mandate from the HCS topic, vault/pool state via RPC, Chainlink feeds at the addresses in §1.3 |
| 4.4 | Rolling-24h notional summed from the journal topic (replaces the hardcoded `0`) |
| 4.5 | `MirrorFundStateProvider` for the Manager |
| 4.6 | Manager actually submits `CONTEXT` and actually calls `vault.trade()` on APPROVED |
| 4.7 | Journaler: real mirror reader + HCS submitter, idempotent on `(nonce, event)` |

**Exit:** Validator answers `/validate` from live testnet state with `MockSources`
deleted from the runtime path. `MockSources` stays in the repo — it is what makes
the test suite offline.

---

## Sprint 5 — Testnet

The scarce resource is testnet HBAR. Estimate gas without `--broadcast` before
every real deploy. **Never redeploy `PoolManager`.**

| # | Task |
|---|---|
| 5.1 | Deploy `PoolManager` — **do this first**, it is the biggest unknown; confirms the 24KB question (RESEARCH §3) |
| 5.2 | Create both HCS topics; write ids to `deployments.json` |
| 5.3 | Deploy `MockUSDC`, mine + deploy `PolicyHook`, `CompliancePolicy`, `MandatePolicy`, `IndentureVault` |
| 5.4 | `04_Wire.s.sol`: register policies, set validator signer, init pool, seed liquidity |
| 5.5 | Regenerate `mandates/fund-one.yaml` from `deployments.json`; compile; `amend()`; publish `MANDATE` envelope |
| 5.6 | Deploy the Validator Worker; `wrangler secret put VALIDATOR_KEY`; real KV namespace ids |
| 5.7 | One real end-to-end trade: proposal → receipt → vault → swap → `Executed` → journal |

**Exit:** `deployments.json` has no empty strings, and one trade is visible on
HashScan and on the journal topic.

---

## Sprint 6 — Frontend live

`apps/web/lib/data.ts` is the single seam by design — this sprint is meant to be
small, and if it is not, the seam was wrong.

| # | Task |
|---|---|
| 6.1 | `lib/data.ts` reads mirror node + RPC instead of `mocks/*.json` |
| 6.2 | `/` mandate hero from `GET /mandate`; `/journal` from the journal topic |
| 6.3 | `/blocked` — the demo's main stage — real refusals from the journal |
| 6.4 | `/shares` — ERC-3643 state, including the frozen-during-breach path |
| 6.5 | Empty states verified: every route renders sensibly with zero data, per `design-tokens.md` |

**Exit:** all 4 routes render live data, no component changed shape.

---

## Sprint 7 — Demo

| # | Task |
|---|---|
| 7.1 | Scripted run: inject → refusal → journal entry → `/blocked` updates |
| 7.2 | Control vault side-by-side (protected vs unprotected) |
| 7.3 | Journaler + agent-tick GitHub Actions crons green on schedule |
| 7.4 | Rehearse cold, twice, on testnet |

**Exit:** the demo runs start to finish without a human editing anything.

---

## Standing rules

Carried from `README.md`; they are constraints on *how* the sprints are done.

1. The mirror node is the only database.
2. The Validator's input is exactly `{poolId, swapParams}`, `.strict()`.
3. The hook trusts a registered signer via `ecrecover` — pluggable.
4. The hook makes zero external calls, zero oracle reads, zero unbounded loops.
5. Anything writing to HCS runs on Node, never on an edge runtime.
6. `deployments.json` is the only source of addresses — never an env var.
7. Every named revert error gets its own Foundry test.
8. 90% of testing on anvil. Testnet for integration and the demo only.

## Sequencing rules

- **Never work ahead of a red test.** The skipped tests are the spec; un-skip in
  order.
- **The receipt seam changes only in a commit where `Receipt.t.sol` goes green
  again.** It is the load-bearing invariant.
- **Anything touching a real network is isolated behind an interface** so the
  offline suite never depends on it (`Sources`, `IIdentityRegistry`).
- **`shared-contracts/` does not drift silently.** Changing a shape means editing
  the spec file in the same commit.
