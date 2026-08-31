/**
 * The journaler is the ONLY component that writes on-chain events to HCS. It
 * needs @hashgraph/sdk (gRPC over HTTP/2) so it runs on Node, never the edge.
 *
 * One tick (see run.ts for the injectable core):
 *   1. read the committed cursor.json
 *   2. poll the mirror node for vault contract logs since cursor.lastTimestamp
 *   3. decode each (Executed / BreachObserved / Amended / ComplianceRefused)
 *   4. skip any whose (event, nonce, tx) dedupe key is already in the cursor
 *   5. submit the HCS envelope, and ONLY THEN advance + persist the cursor
 *
 * Triggers: cron (journaler.yml + workflow_dispatch) and a local watch.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readContractLogs } from "@indenture/hedera/mirror";
import { hcsClient, submit } from "@indenture/hedera/hcs";
import {
  makeEnvelope,
  type EnvelopeType,
} from "@indenture/hedera/envelope";
import { runTick, type Deployments } from "./run.js";
import { cursorPath, loadCursor, saveCursor } from "./cursor.js";

export { runTick } from "./run.js";
export type { TickDeps, Deployments } from "./run.js";

function loadDeployments(): Deployments {
  const path = resolve(process.cwd(), "../../contracts/deployments.json");
  return JSON.parse(readFileSync(path, "utf8")) as Deployments;
}

function auth() {
  const operatorId = process.env.HEDERA_OPERATOR_ID;
  const operatorKey = process.env.HEDERA_OPERATOR_KEY;
  if (!operatorId || !operatorKey) throw new Error("HEDERA_OPERATOR_ID / _KEY not set");
  return { operatorId, operatorKey, network: "testnet" as const };
}

/** Ad-hoc single-envelope submit (used by scripts / the manager fallback path). */
export async function journal(type: EnvelopeType, body: unknown): Promise<void> {
  const dep = loadDeployments();
  if (!dep.hcs.journalTopicId) throw new Error("journalTopicId not set in deployments.json");
  const client = hcsClient(auth());
  const env = makeEnvelope({ type, vault: dep.contracts.IndentureVault, body });
  const { sequenceNumber } = await submit(client, dep.hcs.journalTopicId, env);
  console.log(`[journaler] ${type} -> seq ${sequenceNumber}`);
}

async function tick(): Promise<void> {
  const dep = loadDeployments();
  if (!dep.hcs.journalTopicId || !dep.contracts.IndentureVault) {
    console.log("[journaler] deployments.json not populated yet - dry run, no-op");
    return;
  }
  const client = hcsClient(auth());
  const stats = await runTick({
    deployments: dep,
    loadCursor: () => loadCursor(),
    saveCursor: (c) => saveCursor(c),
    fetchLogs: (id, since, mirrorUrl) =>
      readContractLogs(id, { mirrorUrl, sinceTimestamp: since, order: "asc" }),
    submitEnvelope: async (topicId, env) => {
      const { sequenceNumber } = await submit(client, topicId, env);
      return sequenceNumber;
    },
  });
  console.log(
    `[journaler] tick done: ${stats.journaled} journaled, ${stats.skipped} skipped (cursor ${cursorPath()})`,
  );
}

if (process.argv.includes("--once")) {
  tick().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
