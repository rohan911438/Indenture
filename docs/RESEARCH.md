# Architecture research — findings and decisions

Researched 2026-09-06 against the spec in `README.md` and the code as built.
This file records what was **verified**, what was **found broken**, and the
decisions taken. `PLAN.md` turns the gaps into sprints.

---

## 1. Verified: the architecture is buildable on Hedera

The pitch depends on four things being true on Hedera testnet. All four hold.

### 1.1 Uniswap v4 needs transient storage — Hedera has it

This was the single biggest risk. Uniswap v4's `PoolManager` uses EIP-1153
`TSTORE`/`TLOAD` for its flash-accounting lock and currency deltas. Without it,
v4 does not compile or run, and the whole "final on-chain hook" claim collapses.

[HIP-865][hip865] is **Final**, shipped in Hedera Services **v0.50.1**. It
activates EIP-1153 (`TSTORE`/`TLOAD`) and EIP-5656 (`MCOPY`) with *identical*
opcode numbers, gas schedules and stack semantics to Ethereum mainnet. Cancun's
EIP-4788 is excluded (no EL/CL separation on Hedera), which v4 does not use.

**Decision:** keep `evm_version = "cancun"` in `foundry.toml`. It is correct for
both anvil and Hedera testnet.

### 1.2 Hook address mining needs CREATE2 — Hedera has it

A v4 hook must live at an address whose low 14 bits encode exactly the callbacks
it implements (`Hooks.ALL_HOOK_MASK = (1 << 14) - 1`). `PolicyHook` needs
`BEFORE_SWAP_FLAG` (`1 << 7`) and `AFTER_SWAP_FLAG` (`1 << 6`), so its address
must satisfy `uint160(addr) & 0xFF == 0xC0` with the other 6 mask bits clear.
Reaching that address requires salt mining over CREATE2.

[HIP-329][hip329] shipped CREATE2 in Hedera Services v0.23. Hedera implements it
by aliasing the EIP-1014 deterministic address to the contract's `0.0.X` id, so
the address is computed the standard way and mining works unchanged.

**Decision:** mine the hook salt with `HookMiner` against a CREATE2 deployer, as
on any EVM chain. No Hedera-specific path needed.

### 1.3 Chainlink price feeds are live on Hedera testnet

The README says to read an existing Chainlink `AggregatorV3Interface` rather than
deploy a feed. Hedera's own docs page only shows an *adapter demo*, which
suggested this was wrong — but Chainlink Data Feeds did launch on Hedera, and
**seven feeds exist on testnet**, all standard `AggregatorV3Interface`, 8
decimals:

| Pair | Testnet address |
|---|---|
| HBAR / USD | `0x59bC155EB6c6C415fE43255aF66EcF0523c92B4a` |
| USDC / USD | `0xb632a7e7e02d76c0Ce99d9C62c7a2d1B5F92B6B5` |
| ETH / USD  | `0xb9d461e0b962aF219866aDfA7DD19C52bB9871b9` |
| BTC / USD  | `0x058fE79CB5775d4b167920Ca6036B824805A9ABd` |
| LINK / USD | `0xF111b70231E89D69eBC9f6C9208e9890383Ef432` |
| USDT / USD | `0x06823de8E77d708C4cB72Cbf04495D67afF4Bd37` |
| DAI / USD  | `0xdA2aBF7C90aDC73CDF5cA8d720B87bD5F5863389` |

**Decision:** the README is right — read these, do not deploy a feed. Put the
addresses in `mandates/fund-one.yaml` under `priceFeeds`. See §2.1 for the
heartbeat trap they come with.

### 1.4 ERC-3643 on Hedera is real and SDK-deployable

Hedera's Asset Tokenization Studio added ERC-3643 (Tokeny's T-REX) alongside
ERC-1400. `@hashgraph/asset-tokenization-sdk` exposes `enableERC3643`,
`complianceModules` and `identityRegistry` in its deploy config, and deploys to
testnet and mainnet.

**Decision:** C6 stands — deploy the ATS suite via the SDK, do not hand-roll
ERC-3643. `CompliancePolicy` depends only on the two view functions it already
declares (`isVerified`, `canTransfer`), so it is insulated from SDK churn.

---

## 2. Found broken

### 2.1 CRITICAL — the staleness covenant makes the fund untradeable

Chainlink's Hedera feeds have an **86400-second (24 hour) heartbeat** with a 0.5%
deviation threshold. A feed that has not moved 0.5% legitimately will not update
for up to 24 hours.

`apps/validator/src/sources.ts` hardcodes:

```ts
const FEED_STALE_AFTER_SEC = 3600;   // 1 hour
```

and `runCovenantChecks` refuses **first** on `feedStaleness`. So on real feeds
the Validator would refuse the large majority of proposals with a `feedStaleness`
reason, for feeds that are perfectly healthy. That is a self-inflicted denial of
service that would only appear once the mocks are swapped out — i.e. during the
demo.

Two things are wrong, not one:

1. The tolerance (3600s) is far below the heartbeat (86400s).
2. The tolerance is a **hardcoded constant**, not a mandate field. That
   contradicts the design rule that the Validator derives every fact from the
   mandate. It is exactly the kind of number an auditor would want in the signed,
   hashed rulebook.

**Decision:** add `feedStaleAfterSec` to the mandate YAML and to the compiled
mandate, default `90000` (heartbeat + 1000s margin). The Validator reads it from
the mandate like everything else. It is *not* an on-chain covenant — staleness
judgement stays off-chain per design rule 4, so `MandatePolicy` is unaffected.

### 2.2 `PolicyHook` is not a hook — FIXED (Sprint 1)

`PolicyHook` today is a `mapping(bytes32 => IPolicy)` plus an `internal`
`_beforeSwap` that nothing calls. It does not extend `BaseHook`, does not
implement `getHookPermissions`, has no `onlyPoolManager` guard, and its callback
signatures are not v4's. `PoolManager` would never call it.

Until this is a real `BaseHook`, **none** of the "final on-chain re-check"
claim is backed by code.

### 2.3 `MandatePolicy` does not check any covenant

Step 3 of `beforeSwap` is a comment:

```solidity
// 3. covenants - TODO: compare against post-trade portfolio snapshot
```

So today a valid Validator signature authorises **any** trade of any size. The
headline claim — "even a compromised Validator signature cannot move funds
outside the mandate" — is currently false. This is the single largest gap between
the pitch and the code, and it is what Sprint 2 exists to close.

### 2.4 The `paramsHash` binding will revert every real swap as written — FIXED (Sprint 1)

The Validator computes:

```ts
keccak256(abi.encode(bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96))
```

`MandatePolicy` computes `keccak256(params)` where `params` is `bytes calldata`.

Verified in `lib/v4-core/src/interfaces/IPoolManager.sol:146`: `SwapParams` is
`{bool, int256, uint160}` — three static types, so `abi.encode(params)` is
exactly the 96 bytes the Validator hashes. The two agree **only if** `PolicyHook`
passes `abi.encode(params)` down to the policy. If it forwards raw calldata with
an offset/length prefix, or the struct ever gains a field, every swap reverts
`ParamsMismatch`.

**Decision:** `IPolicy` takes the decoded `SwapParams` struct, not `bytes`, and
`MandatePolicy` computes `keccak256(abi.encode(params))` itself. Guard it with a
test that swaps through a real `PoolManager`, not a unit test — a unit test that
encodes the params itself would pass while production reverted.

**Done.** `packages/receipt/vectors/params.json` holds hashes produced by the
TypeScript signer; `Receipt.t.sol::test_ParamsHashMatchesTypescript` asserts
Solidity reproduces them from `IPoolManager.SwapParams`. `Router.t.sol` then
swaps through a real `PoolManager` end to end.

### 2.5 `IPolicy.beforeSwap` has the wrong return shape — FIXED (Sprint 1)

v4's `IHooks.beforeSwap` returns `(bytes4, BeforeSwapDelta, uint24)`.
`IPolicy.beforeSwap` returns only `bytes4`. The interface must widen (or
`PolicyHook` must adapt and return `BeforeSwapDeltaLibrary.ZERO_DELTA` and `0`).

**Decision:** `PolicyHook` adapts. Policies stay on the narrow `bytes4` contract
so a policy author cannot accidentally take a fee or alter a delta — that keeps
design rule 4 ("compares fixed-width values, nothing else") enforceable by the
type system rather than by review.

### 2.6 The Validator's nonce lock is advisory, and refusals hold it

`POST /validate` does:

```ts
const held = await c.env.CACHE.get(lockKey);   // read
if (held) return refuse(...);
await c.env.CACHE.put(lockKey, "1", ...);      // then write
```

Two problems:

1. **Not atomic.** Workers KV has no compare-and-set, so two concurrent requests
   can both read empty and both sign for the same `seq`. On-chain `seqOf` means
   only one can ever land, so funds are safe — but the journal gets two signed
   receipts for one nonce, which is exactly the kind of thing the journal exists
   to make impossible to explain away.
2. **The lock is taken before the covenant checks.** A *refused* proposal leaves
   the nonce locked for the full 120s TTL, so one bad proposal blocks the next
   legitimate one. For a demo that fires an attack and then a good trade
   back-to-back, this will look like the system broke.

**Decision:** take the lock only on the approval path, immediately before
signing, and release it on refusal. Accept that KV is best-effort and document
that on-chain `seqOf` is the real anti-replay boundary — the lock is a courtesy
that keeps the journal clean, not a security control. Say so in the code.

### 2.7 Nothing is wired to a real chain

`contracts/deployments.json` is all empty strings; `mandates/fund-one.yaml` uses
`0x…d0` / `0x…b0` placeholders. Every address in the system is a mock. This is
by design for the offline-testable phase, and `shared-contracts/mock-status.md`
tracks all 12 seams — but it means Sprint 5 (testnet deploy) is not a
formality, it is where the mocks meet reality.

---

## 3. Risks still open

| Risk | Why it matters | Mitigation |
|---|---|---|
| ~~`PoolManager` vs Hedera's 24,576-byte limit~~ **MEASURED: fits, with 567 bytes to spare** | `forge build --sizes` reports `PoolManager` at **24,009 bytes runtime**. It fits, but the margin is 2.3%. It is also sensitive to compiler settings: v4-core requires `optimizer_runs = 44444444` (at 800 the via-IR pipeline fails with stack-too-deep in `Pool.sol`), and changing that number would move the size. | Treat `optimizer_runs` as fixed while v4-core is a dependency — `foundry.toml` says so. `forge build --sizes` exits non-zero over the limit and already runs in CI, so a regression fails the build. |
| HashIO public relay rate limits + `eth_getLogs` range caps | The journaler polls contract logs. If ranges are capped, the cursor logic needs smaller windows. | Journaler already has a cursor. Test against the real relay in Sprint 5; fall back to mirror-node REST for logs, which the architecture already prefers. |
| Testnet HBAR | Named in the README as the one scarce resource. | Never redeploy `PoolManager`; estimate gas without `--broadcast` first; refill daily. |
| ATS SDK deploy is not offline-testable | It talks to a real network. | Keep `CompliancePolicy` behind the two-view-function interface it already has, so the rest of the system tests against mocks. |

---

## 4. What did not change

These held up under scrutiny and should be defended, not revisited:

- **The `.strict()` Zod boundary.** `{poolId, swapParams}` and nothing else, with
  tests that specifically reject a `context` key and an inner `recipient` key.
  This is the prompt-injection defence and it is real.
- **Refusal is a `200`, malformed is a `400`.** Clean separation between "the
  trade is off-mandate" and "your request is broken".
- **The receipt seam.** `packages/receipt/vectors/receipt-296.json` is a genuine
  viem signature that `Receipt.t.sol` recovers in Solidity. Five tests, passing.
  This is the load-bearing invariant of the whole design and it is already green.
- **The mirror node as the only database.** No Postgres, no indexer.
- **Skipped tests as an executable spec.** 29 skipped Foundry tests with precise
  names (`test_SameReceiptTwice_Reverts_StaleSeq`) are a better backlog than a
  ticket tracker. The plan is largely "un-skip these in dependency order".

[hip865]: https://github.com/hashgraph/hedera-improvement-proposal/blob/main/HIP/hip-865.md
[hip329]: https://hips.hedera.com/HIP/hip-329.html
