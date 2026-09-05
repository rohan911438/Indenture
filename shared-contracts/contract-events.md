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

The four canonical event **declarations** are now in the contracts:

| Contract | Event | Emission |
|---|---|---|
| `IndentureVault` | `Executed(uint64,bytes32,int256,int256)` | declaration frozen; emitted from `trade()` on build step 5 |
| `MandatePolicy` | `Amended(bytes32,uint64)` | **live** — `amend()` bumps `mandateSeq` and emits |
| `MandatePolicy` | `BreachObserved(uint64,bytes32,bytes32)` | declaration frozen; emitted from `afterSwap` with the covenant logic |
| `CompliancePolicy` | `ComplianceRefused(address,bytes32)` | declaration frozen; emitted from the non-reverting rejection path on build step 4 |

`IndentureVault.EmergencyExit(address indexed to)` and
`MandatePolicy.ReceiptConsumed(address indexed vault, uint64 seq, bytes32 paramsHash)`
stay as-is — they are operational, not part of the journal contract.
