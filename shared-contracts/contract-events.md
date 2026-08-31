# Contract events

The events the journaler polls for (via the mirror node) and the web app reads.
Topics are stable; the journaler keys idempotency on `(nonce, event)`.

## Canonical signatures

```solidity
// IndentureVault — one per settled trade
event Executed(uint64 indexed nonce, bytes32 indexed poolId, int256 amount0, int256 amount1);

// MandatePolicy — emitted from afterSwap when a post-trade covenant snapshot is out of bounds
event BreachObserved(uint64 indexed nonce, bytes32 indexed poolId, bytes32 reason);

// MandatePolicy — mandate hash / covenant params rotated by owner
event Amended(bytes32 indexed indentureHash, uint64 indexed seq);

// CompliancePolicy — a swap counterparty failed identity / modular-compliance checks
event ComplianceRefused(address indexed wouldBeHolder, bytes32 reason);
```

`nonce` is the per-vault monotonic receipt `seq` that authorised the trade — it
is the join key between an `Executed`, any `BreachObserved`, and the `RECEIPT` /
`CONTEXT` HCS envelopes for the same tick.

`reason` is a short `bytes32` tag (`bytes32("maxPositionBps")` etc.), not a
string, so the event stays fixed-width and cheap.

## Journaler mapping

| Event | HCS envelope it produces |
|---|---|
| `Executed`        | `RECEIPT` body with `decision: "APPROVED"` (durable mirror of the Validator's approval), if not already journaled from the Validator response |
| `BreachObserved`  | `BREACH` body, `covenant` = decoded `reason`, `nonce` cross-link |
| `Amended`         | `MANDATE` body, `action: "AMENDED"` |
| `ComplianceRefused` | `RECEIPT` body with `decision: "REFUSED"`, `reason` = decoded `reason` |

## Scaffold status (2026-08-31)

The first-commit scaffold emits near-equivalents that are being renamed to the
canonical signatures above:

| Scaffold today | Canonical |
|---|---|
| `IndentureVault.TradeExecuted(bytes32 indexed poolId, int256 delta0, int256 delta1)` | `Executed(uint64 indexed nonce, bytes32 indexed poolId, int256 amount0, int256 amount1)` |
| `MandatePolicy.Amended(bytes32 indexed mandateHash)` | `Amended(bytes32 indexed indentureHash, uint64 indexed seq)` |
| _(none)_ | `BreachObserved`, `ComplianceRefused` — added with the covenant + compliance logic |

`IndentureVault.EmergencyExit(address indexed to)` and
`MandatePolicy.ReceiptConsumed(address indexed vault, uint64 seq, bytes32 paramsHash)`
stay as-is — they are operational, not part of the journal contract.
