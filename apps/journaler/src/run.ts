/**
 * The journaler's tick core. No @hashgraph/sdk import — every side effect is
 * dependency-injected, so this is fast + fully unit-testable offline. The Node
 * entry (index.ts) wires the real mirror reader + HCS submitter into it.
 */
import type { readContractLogs } from "@indenture/hedera/mirror";
import type { Envelope } from "@indenture/hedera/envelope";
import { decodeEvent, dedupeKey, envelopeForEvent } from "./events.js";
import { advance, alreadyJournaled, type Cursor } from "./cursor.js";

export type Deployments = {
  network: { mirrorUrl: string };
  hcs: { journalTopicId: string; mandateTopicId: string };
  contracts: { IndentureVault: string };
};

export type TickDeps = {
  /** returns the vault contract logs newer than `sinceTimestamp` */
  fetchLogs: (
    contractId: string,
    sinceTimestamp: string,
    mirrorUrl: string,
  ) => Promise<Awaited<ReturnType<typeof readContractLogs>>>;
  /** submits one envelope, resolves with the HCS sequence number once confirmed */
  submitEnvelope: (topicId: string, env: Envelope) => Promise<string>;
  loadCursor: () => Cursor;
  saveCursor: (c: Cursor) => void;
  deployments: Deployments;
};

export async function runTick(
  deps: TickDeps,
): Promise<{ journaled: number; skipped: number }> {
  const dep = deps.deployments;
  if (!dep.hcs.journalTopicId) {
    console.log("[journaler] journalTopicId unset - nothing to do");
    return { journaled: 0, skipped: 0 };
  }

  let cursor = deps.loadCursor();
  const logs = await deps.fetchLogs(
    dep.contracts.IndentureVault,
    cursor.lastTimestamp,
    dep.network.mirrorUrl,
  );

  let journaled = 0;
  let skipped = 0;
  for (const log of logs) {
    const ev = decodeEvent(log);
    if (!ev) continue;
    const key = dedupeKey(ev, log.transactionHash);
    if (alreadyJournaled(cursor, key)) {
      skipped++;
      continue;
    }
    const env = envelopeForEvent(
      ev,
      dep.contracts.IndentureVault,
      log.transactionHash,
    );
    const seq = await deps.submitEnvelope(dep.hcs.journalTopicId, env);
    console.log(`[journaler] ${ev.name} ${key} -> journal seq ${seq}`);
    cursor = advance(cursor, key, log.timestamp); // advance ONLY after submit
    deps.saveCursor(cursor);
    journaled++;
  }
  return { journaled, skipped };
}
