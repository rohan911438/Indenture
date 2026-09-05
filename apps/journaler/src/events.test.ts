import { describe, it, expect } from "vitest";
import { encodeAbiParameters, toHex, pad, stringToHex } from "viem";
import type { ContractLog } from "@indenture/hedera/mirror";
import {
  TOPIC0,
  decodeEvent,
  dedupeKey,
  envelopeForEvent,
  eventNameOf,
} from "./events.js";

const POOL = ("0x" + "22".repeat(32)) as `0x${string}`;
const TX = "0x" + "ab".repeat(32);

function log(partial: Partial<ContractLog>): ContractLog {
  return {
    address: "0x00000000000000000000000000000000000000b0",
    topics: [],
    data: "0x",
    blockNumber: 1,
    transactionHash: TX,
    index: 0,
    timestamp: "1725000000.000000000",
    ...partial,
  };
}

describe("eventNameOf", () => {
  it("maps topic0 to the event name", () => {
    expect(eventNameOf(log({ topics: [TOPIC0.Executed] }))).toBe("Executed");
    expect(eventNameOf(log({ topics: ["0xdeadbeef"] }))).toBeNull();
  });
});

describe("decodeEvent — Executed", () => {
  const ev = decodeEvent(
    log({
      topics: [TOPIC0.Executed, toHex(7n, { size: 32 }), POOL],
      data: encodeAbiParameters(
        [{ type: "int256" }, { type: "int256" }],
        [-1000n, 950n],
      ),
    }),
  );

  it("pulls nonce + poolId from topics and amounts from data", () => {
    expect(ev).toMatchObject({ name: "Executed", nonce: 7n, poolId: POOL });
    if (ev?.name === "Executed") {
      expect(ev.amount0).toBe(-1000n);
      expect(ev.amount1).toBe(950n);
    }
  });

  it("becomes an APPROVED RECEIPT envelope tagged onchain", () => {
    const env = envelopeForEvent(ev!, "0x00000000000000000000000000000000000000b0", TX);
    expect(env.type).toBe("RECEIPT");
    const b = env.body as Record<string, unknown>;
    expect(b.decision).toBe("APPROVED");
    expect(b.source).toBe("onchain:Executed");
    expect(b.seq).toBe(7);
  });
});

describe("decodeEvent — BreachObserved", () => {
  const reason = pad(stringToHex("maxPositionBps"), { dir: "right", size: 32 });
  const ev = decodeEvent(
    log({ topics: [TOPIC0.BreachObserved, toHex(7n, { size: 32 }), POOL], data: reason }),
  );

  it("decodes the bytes32 reason tag to text", () => {
    expect(ev).toMatchObject({ name: "BreachObserved", nonce: 7n, reason: "maxPositionBps" });
  });

  it("becomes a BREACH envelope that cross-links the nonce", () => {
    const env = envelopeForEvent(ev!, "0x00000000000000000000000000000000000000b0", TX);
    expect(env.type).toBe("BREACH");
    const b = env.body as Record<string, unknown>;
    expect(b.covenant).toBe("maxPositionBps");
    expect(b.nonce).toBe(7);
  });
});

describe("dedupeKey", () => {
  it("is stable for the same (event, nonce, tx)", () => {
    const ev = decodeEvent(
      log({ topics: [TOPIC0.Executed, toHex(3n, { size: 32 }), POOL], data: encodeAbiParameters([{ type: "int256" }, { type: "int256" }], [0n, 0n]) }),
    )!;
    expect(dedupeKey(ev, TX)).toBe(dedupeKey(ev, TX));
    expect(dedupeKey(ev, TX)).toContain("Executed:3:");
  });
});
