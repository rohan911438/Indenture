# Validator API — wire contract

The Validator is a Cloudflare Worker (Hono + Zod). It holds `VALIDATOR_KEY`.
It re-derives every fact from source and either **signs an EIP-712 receipt** or
**refuses**. A refusal is a normal `200` — never a `4xx`. A `4xx` means only
"your request was malformed", never "the trade is off-mandate".

Base URL: `VALIDATOR_URL` (local: `http://localhost:8787`).

---

## `POST /validate`

The trade boundary. The request body is **exactly** `{ poolId, swapParams }`,
parsed with Zod `.strict()`. Any unknown key — top level or inside
`swapParams` — is a `400`. No free text, no mandate, no prices, no "context"
from the Manager ever crosses this line.

### Request

```jsonc
{
  "poolId": "0x…64 hex chars…",          // v4 PoolId, bytes32
  "swapParams": {
    "zeroForOne": true,                    // bool
    "amountSpecified": "-1000000",         // int256 as decimal string (negative = exact-in)
    "sqrtPriceLimitX96": "4295128740"      // uint160 as decimal string
  }
}
```

Zod (`apps/validator/src/schema.ts`):

```ts
z.object({
  poolId: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  swapParams: z.object({
    zeroForOne: z.boolean(),
    amountSpecified: z.string().regex(/^-?\d+$/),
    sqrtPriceLimitX96: z.string().regex(/^\d+$/),
  }).strict(),
}).strict()
```

### `200` — APPROVED (signed)

```jsonc
{
  "decision": "APPROVED",
  "receipt": {
    "mandateHash": "0x…32 bytes…",   // keccak256 of the canonical compiled mandate
    "poolId":      "0x…32 bytes…",
    "paramsHash":  "0x…32 bytes…",   // keccak256(abi.encode(SwapParams)) — binds the exact trade
    "seq":         "0",               // uint64 as string — per-vault monotonic nonce (anti-replay)
    "deadline":    "1725120000",      // uint64 as string — unix seconds, = now + 120
    "vault":       "0x…20 bytes…"
  },
  "signature": "0x…65-byte sig…",
  "signer":    "0x…validator address…",
  "journal": {                        // RECEIPT envelope, ready for the journaler to submit
    "v": 1, "type": "RECEIPT", "vault": "0x…", "ts": 1725119880,
    "body": { "decision": "APPROVED", "reason": "covenants satisfied",
              "mandateHash": "0x…", "poolId": "0x…", "paramsHash": "0x…",
              "seq": 0, "signature": "0x…" }
  }
}
```

`receipt` field order is part of the EIP-712 type hash — see
`hcs-envelope-schema.md` and `packages/receipt`. Do not reorder.

### `200` — REFUSED

```jsonc
{
  "decision": "REFUSED",
  "reason": "maxPositionBps: asset would reach 4127bps > 3000bps cap",
  "detail": {                          // machine-readable; shape depends on which check failed
    "covenant": "maxPositionBps",
    "observed": "4127",
    "limit": "3000"
  },
  "journal": {
    "v": 1, "type": "RECEIPT", "vault": "0x…", "ts": 1725119880,
    "body": { "decision": "REFUSED", "reason": "maxPositionBps: …",
              "mandateHash": "0x…", "poolId": "0x…", "paramsHash": "0x…", "seq": 0 }
  }
}
```

Refusal reasons (the `covenant` field), in check order:

| `covenant`         | Meaning |
|--------------------|---------|
| `feedStaleness`    | A price feed the trade depends on is older than the mandate tolerance. The Validator refuses; the hook never sees a staleness judgement. |
| `assetNotInUniverse` | The bought asset is not in the mandate `universe`. |
| `maxTradeNotional` | `|amountSpecified|` priced in quote units exceeds the per-trade cap. |
| `maxDailyNotional` | Rolling 24h notional (summed from the journal topic) would exceed the daily cap. |
| `maxPositionBps`   | Post-trade weight of the bought asset exceeds the single-asset cap. |
| `minCashBps`       | Post-trade quote-currency reserve falls below the floor. |

### `400` — malformed request (NOT a refusal)

```jsonc
{ "decision": "REFUSED", "reason": "bad request shape", "issues": [ /* zod issues */ ] }
```

---

## `GET /mandate`

Returns the mandate the Validator is currently enforcing, so the frontend can
render the rulebook without recompiling YAML.

```jsonc
{
  "yaml": "version: 1\nname: Fund One\n…",   // the raw source
  "mandateHash": "0x…32 bytes…",              // keccak256 of the canonical JSON
  "seq": 3,                                    // mandate topic sequence number it was read from
  "covenants": {
    "maxPositionBps": 3000,
    "minCashBps": 1000,
    "maxTradeNotional": "250000000000",
    "maxDailyNotional": "1000000000000"
  }
}
```

---

## `GET /health`

```jsonc
{
  "ok": true,
  "service": "indenture-validator",
  "validator": "0x…address derived from VALIDATOR_KEY…",
  "mandateSeq": 3,          // mandate topic seq currently loaded, or null
  "feedAgeSeconds": 12,     // age of the oldest price feed the mandate references, or null
  "chainId": 296
}
```

`/health` never signs and never touches KV. It is safe to poll.
