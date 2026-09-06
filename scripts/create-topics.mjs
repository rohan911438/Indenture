#!/usr/bin/env node
/**
 * Create the two Hedera Consensus Service topics and record them in
 * contracts/deployments.json.
 *
 * These topics ARE the database. There is no Postgres, no indexer, no
 * Supabase — design rule 1. The mandate the fund is bound by, every approval,
 * every refusal and every observed breach live on HCS, and everything that
 * reads them (the Validator, the journaler, the prospectus) reads them back
 * through the mirror node. That is why this runs before anything is journaled
 * and why the ids go in deployments.json rather than an env var: an address
 * read from the environment is an address nobody can audit.
 *
 * Two topics, not one, because they have different audiences and different
 * write rates:
 *
 *   mandateTopicId   MANDATE envelopes — the rulebook. Rarely written, and the
 *                    Validator reads the LATEST one on every decision, so
 *                    keeping it separate means that read is not a scan through
 *                    thousands of receipts.
 *   journalTopicId   RECEIPT / BREACH / CONTEXT — the running record.
 *
 * Idempotent: topics already recorded in deployments.json are left alone.
 * Creating a second journal topic would silently orphan the entire history.
 *
 * Usage:
 *   HEDERA_OPERATOR_ID=0.0.xxxx HEDERA_OPERATOR_KEY=302e... \
 *     node scripts/create-topics.mjs [--network testnet]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { hcsClient, createTopic } from "@indenture/hedera/hcs";

const args = process.argv.slice(2);
const argOf = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const network = argOf("--network", "testnet");
const root = process.env.INIT_CWD ?? process.cwd();
const path = resolve(root, argOf("--deployments", "contracts/deployments.json"));

const operatorId = process.env.HEDERA_OPERATOR_ID;
const operatorKey = process.env.HEDERA_OPERATOR_KEY;

if (!operatorId || !operatorKey || operatorId === "0.0.000000") {
  console.error("HEDERA_OPERATOR_ID / HEDERA_OPERATOR_KEY must be set to a funded account.");
  console.error("Testnet accounts are free at https://portal.hedera.com.");
  process.exit(1);
}

const deployments = JSON.parse(readFileSync(path, "utf8"));
deployments.hcs ??= {};

let client;
try {
  client = hcsClient({ operatorId, operatorKey, network });
} catch (e) {
  console.error(`Could not build a Hedera client: ${e.message}`);
  console.error("HEDERA_OPERATOR_KEY must be a DER-encoded private key (starts 302e...).");
  process.exit(1);
}

const wanted = [
  {
    key: "mandateTopicId",
    memo: "indenture:mandate:v1 - compiled mandate adoptions and amendments",
  },
  {
    key: "journalTopicId",
    memo: "indenture:journal:v1 - receipts, breaches and manager context",
  },
];

let created = 0;
for (const { key, memo } of wanted) {
  const existing = deployments.hcs[key];
  if (existing) {
    console.log(`${key} already set to ${existing} - leaving it alone`);
    continue;
  }
  const id = await createTopic(client, memo);
  deployments.hcs[key] = id;
  created += 1;
  console.log(`${key} -> ${id}`);
}

if (created > 0) {
  writeFileSync(path, `${JSON.stringify(deployments, null, 2)}\n`, "utf8");
  console.log(`\nwrote ${path}`);
  console.log("Next: publish the mandate with `node scripts/publish-mandate.mjs`.");
} else {
  console.log("\nNothing to do.");
}

client.close();
