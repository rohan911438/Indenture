#!/usr/bin/env node
/**
 * Publish the compiled mandate to the mandate HCS topic.
 *
 * This is the step that makes the fund's rulebook a public, timestamped,
 * append-only document rather than a file in a repo. After it runs:
 *
 *   - the Validator stops using its embedded fixture and reads the mandate
 *     from the topic on every decision (MirrorSources.mandate());
 *   - the prospectus can render the rulebook without trusting the backend;
 *   - the mandateHash on chain, the hash the Validator signs against, and the
 *     hash in the journal are all the same number, derived from one document.
 *
 * The envelope carries the raw YAML, not just the covenants. Anyone auditing a
 * refusal must be able to recompute the hash themselves from the source the
 * fund actually adopted — a summary of the rules is not the rules.
 *
 * Usage:
 *   HEDERA_OPERATOR_ID=... HEDERA_OPERATOR_KEY=... \
 *     node scripts/publish-mandate.mjs [--action ADOPTED|AMENDED]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hcsClient, submit } from "@indenture/hedera/hcs";
import { makeEnvelope } from "@indenture/hedera/envelope";
import { compileMandate } from "@indenture/mandate";
import { readTopic } from "@indenture/hedera/mirror";

const args = process.argv.slice(2);
const argOf = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const root = process.env.INIT_CWD ?? process.cwd();
const deployments = JSON.parse(
  readFileSync(resolve(root, "contracts/deployments.json"), "utf8"),
);
const yamlPath = resolve(root, argOf("--mandate", "mandates/fund-one.yaml"));
const yaml = readFileSync(yamlPath, "utf8");

const topic = deployments.hcs?.mandateTopicId;
const vault = deployments.contracts?.IndentureVault;

if (!topic) {
  console.error("hcs.mandateTopicId is unset. Run scripts/create-topics.mjs first.");
  process.exit(1);
}
if (!vault) {
  console.error("contracts.IndentureVault is unset. Deploy first.");
  process.exit(1);
}

const operatorId = process.env.HEDERA_OPERATOR_ID;
const operatorKey = process.env.HEDERA_OPERATOR_KEY;
if (!operatorId || !operatorKey) {
  console.error("HEDERA_OPERATOR_ID / HEDERA_OPERATOR_KEY must be set.");
  process.exit(1);
}

const compiled = compileMandate(yaml);

// The mandate a fund is bound by must match the one its policy enforces. If
// these differ, every trade reverts with StaleMandate and the reason is
// invisible from either side alone — so check before writing an envelope that
// would be wrong the moment it landed.
const mirrorUrl =
  deployments.network?.mirrorUrl ?? "https://testnet.mirrornode.hedera.com/api/v1";

const existing = await readTopic(topic, { mirrorUrl, order: "desc", limit: 25 }).catch(() => []);
const previous = existing.find((m) => m.envelope?.type === "MANDATE");
const prevHash = previous?.envelope?.body?.mandateHash ?? null;

if (prevHash === compiled.hash) {
  console.log(`This exact mandate is already the latest on ${topic}.`);
  console.log(`  mandateHash ${compiled.hash}`);
  console.log("Nothing to publish.");
  process.exit(0);
}

const action = argOf("--action", prevHash ? "AMENDED" : "ADOPTED");

const envelope = makeEnvelope({
  type: "MANDATE",
  vault,
  body: {
    action,
    mandateHash: compiled.hash,
    yaml,
    covenants: {
      maxPositionBps: Number(compiled.covenantArgs.maxPositionBps),
      minCashBps: Number(compiled.covenantArgs.minCashBps),
      maxTradeNotional: compiled.covenantArgs.maxTradeNotional.toString(),
      maxDailyNotional: compiled.covenantArgs.maxDailyNotional.toString(),
      feedStaleAfterSec: compiled.feedStaleAfterSec,
    },
    prevMandateHash: prevHash,
  },
});

const client = hcsClient({ operatorId, operatorKey, network: "testnet" });
const { sequenceNumber } = await submit(client, topic, envelope);
client.close();

console.log(`${action} -> topic ${topic}, sequence ${sequenceNumber}`);
console.log(`  mandateHash  ${compiled.hash}`);
if (prevHash) console.log(`  previous     ${prevHash}`);
console.log(
  "\nThe on-chain covenants must match. Re-run script/04_Wire.s.sol so MandatePolicy.amend()",
);
console.log("records this same hash, or every trade will revert with StaleMandate.");
