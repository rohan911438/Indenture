# HCS envelope schema

Every message on either HCS topic is one envelope. The envelope is pure data
(no `@hashgraph/sdk` import) so the edge Validator can *build* one; only the
Node journaler *submits* it.

Source of truth: `packages/hedera/src/envelope.ts` (`envelopeSchema`,
`makeEnvelope`).

## Envelope

```jsonc
{
  "v": 1,                                  // literal 1
  "type": "MANDATE" | "RECEIPT" | "BREACH" | "CONTEXT",
  "vault": "0x…20 bytes…",                  // the IndentureVault this message is about
  "ts": 1725119880,                         // unix seconds, set by the submitter
  "body": { /* type-specific, see below */ }
}
```

`envelopeSchema` is `.strict()` — unknown top-level keys are rejected, and an
unknown `type` is rejected.

## Topics

| Topic | Carries |
|---|---|
| `mandateTopicId` | `MANDATE` |
| `journalTopicId` | `RECEIPT`, `BREACH`, `CONTEXT` |

Both topic ids live in `contracts/deployments.json` (`hcs.*`). Never read them
from an env var.

---

## `body` by `type`

### `MANDATE` — a compiled mandate was adopted or amended

```jsonc
{
  "action": "ADOPTED" | "AMENDED",
  "mandateHash": "0x…32 bytes…",          // keccak256 of the canonical JSON
  "yaml": "version: 1\n…",                 // the exact source that was compiled
  "covenants": {
    "maxPositionBps": 3000,
    "minCashBps": 1000,
    "maxTradeNotional": "250000000000",
    "maxDailyNotional": "1000000000000"
  },
  "prevMandateHash": "0x…" | null          // set on AMENDED
}
```

### `RECEIPT` — the Validator approved OR refused a proposal

`packages/hedera/src/envelope.ts` → `receiptBody` (`.strict()`).

```jsonc
{
  "decision": "APPROVED" | "REFUSED",
  "reason": "covenants satisfied"          // for REFUSED this string is the whole point
           | "maxPositionBps: …",
  "mandateHash": "0x…32 bytes…",
  "poolId": "0x…32 bytes…",
  "paramsHash": "0x…32 bytes…",
  "seq": 0,                                 // number (uint64 fits in JS for demo ranges)
  "signature": "0x…65 bytes…"               // present ONLY when APPROVED
}
```

### `BREACH` — a covenant breach was observed on-chain

`packages/hedera/src/envelope.ts` → `breachBody` (`.strict()`).

```jsonc
{
  "covenant": "maxPositionBps" | "minCashBps" | "maxTradeNotional" | "maxDailyNotional",
  "observedTxHash": "0x…32 bytes…",
  "detail": "asset 0x…d0 reached 3411bps (cap 3000) after tx",
  "nonce": 7                                // the Executed/receipt seq this breach cross-links to
}
```

### `CONTEXT` — the untrusted Manager's raw proposal + reasoning

Journaled for the audit trail. **Never** forwarded to the Validator.

```jsonc
{
  "proposer": "RuleProposer" | "LlmProposer",
  "poolId": "0x…32 bytes…",
  "swapParams": { "zeroForOne": true, "amountSpecified": "-1000000", "sqrtPriceLimitX96": "4295128740" },
  "reasoning": "free text from the model / rule engine — audit only",
  "injected": false                        // true when produced by `npm run inject`
}
```
