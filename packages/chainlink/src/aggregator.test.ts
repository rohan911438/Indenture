import { describe, it, expect } from "vitest";
import {
  createPublicClient,
  custom,
  encodeAbiParameters,
  parseAbiParameters,
  toFunctionSelector,
  type Hex,
} from "viem";
import { readFeed } from "./aggregator.js";

const FEED = "0x00000000000000000000000000000000000000e0";
const NOW = 1_800_000_000;

const SEL = {
  latestRoundData: toFunctionSelector(
    "function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)",
  ),
  decimals: toFunctionSelector("function decimals() view returns (uint8)"),
};

type Round = {
  roundId: bigint;
  answer: bigint;
  updatedAt: bigint;
  answeredInRound: bigint;
  decimals?: number;
  throws?: boolean;
};

function clientFor(r: Round) {
  return createPublicClient({
    transport: custom({
      async request({ method, params }: { method: string; params?: unknown[] }) {
        if (r.throws) throw new Error("execution reverted");
        if (method !== "eth_call") throw new Error(`unexpected ${method}`);
        const { data } = (params as [{ to: Hex; data: Hex }])[0];
        if (data.slice(0, 10) === SEL.decimals) {
          return encodeAbiParameters(parseAbiParameters("uint8"), [r.decimals ?? 8]);
        }
        return encodeAbiParameters(parseAbiParameters("uint80,int256,uint256,uint256,uint80"), [
          r.roundId,
          r.answer,
          r.updatedAt,
          r.updatedAt,
          r.answeredInRound,
        ]);
      },
    }),
  });
}

/** A healthy $1.00 answer published 30 seconds ago. */
const healthy: Round = {
  roundId: 42n,
  answer: 100_000_000n,
  updatedAt: BigInt(NOW - 30),
  answeredInRound: 42n,
};

const read = (r: Partial<Round>, maxAgeSec = 90_000) =>
  readFeed(clientFor({ ...healthy, ...r }), FEED, { maxAgeSec, nowSec: NOW });

describe("readFeed", () => {
  it("accepts a healthy round", async () => {
    const f = await read({});
    expect(f.ok).toBe(true);
    if (f.ok) {
      expect(f.answer).toBe(100_000_000n);
      expect(f.decimals).toBe(8);
      expect(f.ageSec).toBe(30);
    }
  });

  // The four checks the naive read skips. Each of these would otherwise be
  // priced as a real answer.

  it("rejects a round that has not completed (updatedAt == 0)", async () => {
    const f = await read({ updatedAt: 0n });
    expect(f.ok).toBe(false);
    if (!f.ok) expect(f.fault).toBe("incompleteRound");
  });

  it("rejects an answer carried over from an earlier round", async () => {
    // The feed is explicitly saying it has no fresh answer for round 42.
    const f = await read({ roundId: 42n, answeredInRound: 41n });
    expect(f.ok).toBe(false);
    if (!f.ok) expect(f.fault).toBe("staleRound");
  });

  it("rejects a zero price", async () => {
    // Pricing a portfolio at zero reads as a total loss and trips covenants
    // in the wrong direction.
    const f = await read({ answer: 0n });
    expect(f.ok).toBe(false);
    if (!f.ok) expect(f.fault).toBe("nonPositiveAnswer");
  });

  it("rejects a negative price", async () => {
    const f = await read({ answer: -1n });
    expect(f.ok).toBe(false);
    if (!f.ok) expect(f.fault).toBe("nonPositiveAnswer");
  });

  // Staleness, which on Hedera is the one that bites the wrong way.

  it("accepts a feed one full 86400s heartbeat old", async () => {
    // Chainlink's Hedera feeds beat every 24h. A day-old answer on an
    // unmoved pair is HEALTHY, and refusing it stops the fund trading.
    const f = await read({ updatedAt: BigInt(NOW - 86_400) }, 90_000);
    expect(f.ok).toBe(true);
  });

  it("rejects a feed past the mandate tolerance", async () => {
    const f = await read({ updatedAt: BigInt(NOW - 90_001) }, 90_000);
    expect(f.ok).toBe(false);
    if (!f.ok) {
      expect(f.fault).toBe("stale");
      expect(f.detail.toleranceSec).toBe("90000");
    }
  });

  it("clamps a future timestamp to age zero rather than going negative", async () => {
    const f = await read({ updatedAt: BigInt(NOW + 5) });
    expect(f.ok).toBe(true);
    if (f.ok) expect(f.ageSec).toBe(0);
  });

  it("returns a fault instead of throwing when the feed is unreachable", async () => {
    // The Validator's job when it cannot see a price is to refuse with a
    // reason, not to crash and be restarted into the same state.
    const f = await read({ throws: true });
    expect(f.ok).toBe(false);
    if (!f.ok) expect(f.fault).toBe("unreadable");
  });
});
