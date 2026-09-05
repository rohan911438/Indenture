# What is mocked, and where the real wiring plugs in

This backend pass is fully testable offline. Everything that will eventually
touch the chain, the mirror node, a price feed, or a real key is behind a seam
with a mock implementation. This file is the checklist for swapping each one.

| # | Mock today | Real implementation | Seam (change here only) |
|---|---|---|---|
| 1 | `VALIDATOR_KEY` = anvil account #0 (`0xf39Fd6…2266`) | throwaway testnet key as a Wrangler secret | `.env` / `.dev.vars` / `wrangler secret put` — no code |
| 2 | `MANAGER_KEY`, `HEDERA_OPERATOR_*`, `ISSUER_KEY` | real testnet keys as GitHub / laptop secrets | `.env` + CI secrets — no code |
| 3 | Validator facts come from `MockSources` (fixed fund: NAV 1M, cash 4000bps, d0 2500bps, d1 2000bps; feeds always fresh) | `MirrorSources`: mandate from the mandate HCS topic, vault/pool state via RPC, Chainlink `AggregatorV3` feeds | `apps/validator/src/sources.ts` → `sourcesFor()` in `index.ts` |
| 4 | Mandate YAML is embedded in `apps/validator/src/mandate-fixture.ts` | read the latest `MANDATE` envelope from the mandate HCS topic | `MockSources.mandate()` → `MirrorSources.mandate()` |
| 5 | Rolling-24h notional = `0` | sum `Executed` notionals from the journal topic over the trailing 24h | `MockSources.covenantInputs()` `priorDailyNotionalQuote` |
| 6 | Manager fund state = `MockFundStateProvider` (mirrors #3) | `MirrorFundStateProvider` reading vault balances + feeds | `apps/manager/src/fund-state.ts` → `stateProvider()` in `index.ts` |
| 7 | Manager `CONTEXT` is logged, not submitted, unless `HEDERA_OPERATOR_*` set | always submit via the journaler | `apps/manager/src/index.ts` → `submitContext()` |
| 8 | Manager `vault.trade()` on APPROVED is a `console.log` | `viem` walletClient `writeContract` with `MANAGER_KEY` | `apps/manager/src/index.ts` — end of `tick()` |
| 9 | Journaler `tick()` no-ops (empty `deployments.json`) | `runTick()` with the real mirror reader + HCS submitter (already wired in `index.ts`) | populate `contracts/deployments.json` |
| 10 | `contracts/deployments.json` addresses / topic ids are all `""` | written by `script/0*.s.sol` on deploy | the deploy scripts |
| 11 | `mandates/fund-one.yaml` addresses are `0x…d0` / `0x…b0` placeholders | regenerate from `deployments.json` after deploy, then `amend()` | `mandates/fund-one.yaml` |
| 12 | Solidity `Executed` / `BreachObserved` / `ComplianceRefused` are **declared** but not emitted | emitted with the trade + covenant + compliance logic | build steps 4/5 in `contracts/src` |

## Invariant that is NOT mocked

The receipt seam is real: `packages/receipt/vectors/receipt-296.json` is a
genuine viem signature, and `contracts/test/Receipt.t.sol` recovers it with the
same domain separator computed by `ReceiptLib.domainSeparator()`. The
hand-verified digest match is in commit `abce8c6`.
