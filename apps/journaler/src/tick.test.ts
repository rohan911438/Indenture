import { describe, it, expect, vi } from "vitest";
import { encodeAbiParameters, toHex } from "viem";
import type { ContractLog } from "@indenture/hedera/mirror";
import type { Envelope } from "@indenture/hedera/envelope";
import { runTick, type TickDeps } from "./run.js";
import { TOPIC0 } from "./events.js";
import type { Cursor } from "./cursor.js";

const VAULT = "0x00000000000000000000000000000000000000b0";
const POOL = ("0x" + "22".repeat(32)) as `0x${string}`;

const deployments = {
  network: { mirrorUrl: "https://m.test/api/v1" },
  hcs: { journalTopicId: "0.0.9001", mandateTopicId: "0.0.9000" },
  contracts: { IndentureVault: VAULT },
};

function executedLog(nonce: bigint, tx: string, ts: string): ContractLog {
  return {
    address: VAULT,
    topics: [TOPIC0.Executed, toHex(nonce, { size: 32 }), POOL],
    data: encodeAbiParameters([{ type: "int256" }, { type: "int256" }], [-1n, 1n]),
    blockNumber: 1,
    transactionHash: tx,
    index: 0,
    timestamp: ts,
  };
}

function harness(logs: ContractLog[], startCursor: Cursor) {
  let cursor = startCursor;
  const submitted: Envelope[] = [];
  const saves: Cursor[] = [];
  const deps: TickDeps = {
    deployments,
    fetchLogs: async () => logs,
    submitEnvelope: async (_t, env) => {
      submitted.push(env);
      return String(submitted.length);
    },
    loadCursor: () => cursor,
    saveCursor: (c) => {
      cursor = c;
      saves.push(c);
    },
  };
  return { deps, submitted, saves, get cursor() { return cursor; } };
}

describe("runTick", () => {
  it("journals each new event once and advances the cursor after submit", async () => {
    const h = harness(
      [
        executedLog(1n, "0xaa", "100.1"),
        executedLog(2n, "0xbb", "100.2"),
      ],
      { lastTimestamp: "0.0", journaled: [] },
    );
    const stats = await runTick(h.deps);
    expect(stats).toEqual({ journaled: 2, skipped: 0 });
    expect(h.submitted.map((e) => e.type)).toEqual(["RECEIPT", "RECEIPT"]);
    expect(h.cursor.lastTimestamp).toBe("100.2");
    expect(h.cursor.journaled).toHaveLength(2);
  });

  it("skips an event whose dedupe key is already committed", async () => {
    const h = harness(
      [executedLog(1n, "0xaa", "100.1"), executedLog(2n, "0xbb", "100.2")],
      { lastTimestamp: "100.1", journaled: ["Executed:1:0xaa"] },
    );
    const stats = await runTick(h.deps);
    expect(stats).toEqual({ journaled: 1, skipped: 1 });
    expect(h.submitted).toHaveLength(1);
  });

  it("does not advance the cursor if submit throws", async () => {
    const h = harness([executedLog(1n, "0xaa", "100.1")], {
      lastTimestamp: "0.0",
      journaled: [],
    });
    h.deps.submitEnvelope = vi.fn().mockRejectedValue(new Error("HCS down"));
    await expect(runTick(h.deps)).rejects.toThrow("HCS down");
    expect(h.cursor.lastTimestamp).toBe("0.0");
    expect(h.saves).toHaveLength(0);
  });

  it("no-ops when journalTopicId is unset", async () => {
    const h = harness([executedLog(1n, "0xaa", "100.1")], {
      lastTimestamp: "0.0",
      journaled: [],
    });
    h.deps.deployments = { ...deployments, hcs: { ...deployments.hcs, journalTopicId: "" } };
    expect(await runTick(h.deps)).toEqual({ journaled: 0, skipped: 0 });
  });
});
