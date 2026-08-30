/**
 * The journaler is the ONLY component that writes to HCS. It needs
 * @hashgraph/sdk (gRPC over HTTP/2) so it runs on Node, never on the edge.
 *
 * Two triggers:
 *   - cron (journaler.yml, + workflow_dispatch for the demo)
 *   - local watch: tail the chain for the vault's Swap events
 *
 * It emits:
 *   RECEIPT  - mirrors the Validator's APPROVED/REFUSED decision (durable copy)
 *   BREACH   - when an on-chain covenant breach is observed
 *   CONTEXT  - the Manager's raw proposal + reasoning
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hcsClient, submit } from "@indenture/hedera/hcs";
import { makeEnvelope, type EnvelopeType } from "@indenture/hedera/envelope";

type Deployments = {
  hcs: { journalTopicId: string; mandateTopicId: string };
  contracts: { IndentureVault: string };
};

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

export async function journal(type: EnvelopeType, body: unknown): Promise<void> {
  const dep = loadDeployments();
  if (!dep.hcs.journalTopicId) throw new Error("journalTopicId not set in deployments.json");
  const client = hcsClient(auth());
  const env = makeEnvelope({ type, vault: dep.contracts.IndentureVault, body });
  const { sequenceNumber } = await submit(client, dep.hcs.journalTopicId, env);
  console.log(`[journaler] ${type} -> seq ${sequenceNumber}`);
}

async function tick(): Promise<void> {
  // TODO: query mirror node for new vault Swap events since last seq; for each,
  //       derive whether a covenant is breached and emit RECEIPT / BREACH.
  console.log("[journaler] tick: STUB - no new events");
}

if (process.argv.includes("--once")) {
  tick().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
