/**
 * The on-chain events the journaler mirrors into HCS. Pure: takes a mirror-node
 * ContractLog, returns a typed record and/or an HCS Envelope. No network here.
 *
 * Signatures are frozen in shared-contracts/contract-events.md.
 */
import {
  decodeAbiParameters,
  hexToString,
  trim,
  type Hex,
} from "viem";
import { makeEnvelope, type Envelope } from "@indenture/hedera/envelope";
import type { ContractLog } from "@indenture/hedera/mirror";

/** topic0 (event signature hash) -> event name */
export const TOPIC0 = {
  Executed: "0x413ae2c07ccde9354fa7d47fee69da2934f4385ecb1d70d54694135b5160a895",
  BreachObserved:
    "0x6067873f01719e15ec279f3b5d984c89ab43f682d9e5057a6e047c36b5ddb65f",
  Amended: "0x3a91c0e26895b9fea8ca95819eb5417e46ba8f85ee0045a21ac3a81b9e0cc083",
  ComplianceRefused:
    "0x8a23c45fc1bca8fd96b51843e4d73974672f75d14c07defd79baec9eabb4b81f",
} as const;

export type EventName = keyof typeof TOPIC0;

const BY_TOPIC0: Record<string, EventName> = Object.fromEntries(
  Object.entries(TOPIC0).map(([k, v]) => [v.toLowerCase(), k as EventName]),
);

export function eventNameOf(log: ContractLog): EventName | null {
  return BY_TOPIC0[(log.topics[0] ?? "").toLowerCase()] ?? null;
}

/** bytes32 reason tag -> readable string (e.g. 0x6d6178... -> "maxPositionBps") */
export function decodeReason(b32: Hex): string {
  try {
    return hexToString(trim(b32, { dir: "right" })) || b32;
  } catch {
    return b32;
  }
}

export type DecodedEvent =
  | {
      name: "Executed";
      nonce: bigint;
      poolId: Hex;
      amount0: bigint;
      amount1: bigint;
    }
  | { name: "BreachObserved"; nonce: bigint; poolId: Hex; reason: string }
  | { name: "Amended"; indentureHash: Hex; seq: bigint }
  | { name: "ComplianceRefused"; wouldBeHolder: Hex; reason: string };

function topicToBigInt(t: string | undefined): bigint {
  return BigInt(t ?? "0x0");
}
function topicToAddress(t: string | undefined): Hex {
  return (("0x" + (t ?? "0x0").slice(-40)) as Hex);
}

/** Decode one log. Indexed args come from topics[1..]; the rest from `data`. */
export function decodeEvent(log: ContractLog): DecodedEvent | null {
  const name = eventNameOf(log);
  if (!name) return null;
  const t = log.topics;

  if (name === "Executed") {
    const [amount0, amount1] = decodeAbiParameters(
      [{ type: "int256" }, { type: "int256" }],
      log.data as Hex,
    ) as [bigint, bigint];
    return {
      name,
      nonce: topicToBigInt(t[1]),
      poolId: (t[2] ?? "0x0") as Hex,
      amount0,
      amount1,
    };
  }
  if (name === "BreachObserved") {
    return {
      name,
      nonce: topicToBigInt(t[1]),
      poolId: (t[2] ?? "0x0") as Hex,
      reason: decodeReason((log.data || (t[3] ?? "0x0")) as Hex),
    };
  }
  if (name === "Amended") {
    return {
      name,
      indentureHash: (t[1] ?? "0x0") as Hex,
      seq: topicToBigInt(t[2]),
    };
  }
  // ComplianceRefused
  return {
    name,
    wouldBeHolder: topicToAddress(t[1]),
    reason: decodeReason((log.data || "0x0") as Hex),
  };
}

/** Stable idempotency key: an event is journaled at most once. */
export function dedupeKey(ev: DecodedEvent, txHash: string): string {
  switch (ev.name) {
    case "Executed":
    case "BreachObserved":
      return `${ev.name}:${ev.nonce}:${txHash}`;
    case "Amended":
      return `${ev.name}:${ev.indentureHash}:${ev.seq}`;
    case "ComplianceRefused":
      return `${ev.name}:${ev.wouldBeHolder}:${txHash}`;
  }
}

/** Build the HCS envelope for a decoded event (matching hcs-envelope-schema.md). */
export function envelopeForEvent(
  ev: DecodedEvent,
  vault: string,
  txHash: string,
): Envelope {
  switch (ev.name) {
    case "Executed":
      return makeEnvelope({
        type: "RECEIPT",
        vault,
        body: {
          decision: "APPROVED",
          reason: "covenants satisfied",
          source: "onchain:Executed",
          poolId: ev.poolId,
          seq: Number(ev.nonce),
          amount0: ev.amount0.toString(),
          amount1: ev.amount1.toString(),
          observedTxHash: txHash,
        },
      });
    case "BreachObserved":
      return makeEnvelope({
        type: "BREACH",
        vault,
        body: {
          covenant: ev.reason,
          observedTxHash: txHash,
          detail: `poolId ${ev.poolId} breached ${ev.reason} at nonce ${ev.nonce}`,
          nonce: Number(ev.nonce),
        },
      });
    case "Amended":
      return makeEnvelope({
        type: "MANDATE",
        vault,
        body: {
          action: "AMENDED",
          mandateHash: ev.indentureHash,
          seq: Number(ev.seq),
          observedTxHash: txHash,
        },
      });
    case "ComplianceRefused":
      return makeEnvelope({
        type: "RECEIPT",
        vault,
        body: {
          decision: "REFUSED",
          reason: ev.reason,
          source: "onchain:ComplianceRefused",
          wouldBeHolder: ev.wouldBeHolder,
          observedTxHash: txHash,
        },
      });
  }
}
