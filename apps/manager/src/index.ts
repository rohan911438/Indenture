/**
 * One tick of the Manager (untrusted by design):
 *   1. read fund state (mirror node; mock in local dev)
 *   2. ask the configured Proposer for a {poolId, swapParams} proposal
 *   3. journal the raw proposal + reasoning as CONTEXT (never sent to Validator)
 *   4. POST exactly {poolId, swapParams} to the Validator
 *   5. on APPROVED: encode the receipt blob + submit vault.trade()
 *      on REFUSED:  log + stop (the refusal is already journaled by the Validator)
 *
 * Runs under GitHub Actions cron (agent-tick.yml) with workflow_dispatch so it
 * can be fired live on stage.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildManagerPrompt, compileMandate } from "@indenture/mandate";
import type { Proposer } from "./proposer.js";
import { RuleProposer } from "./rule-proposer.js";
import { LlmProposer } from "./llm-proposer.js";
import { MockFundStateProvider, type FundStateProvider } from "./fund-state.js";
import {
  buildContextEnvelope,
  encodeReceiptBlob,
  validatorRequest,
} from "./context.js";

const VAULT_MOCK = "0x00000000000000000000000000000000000000b0";

function mandatePrompt(): string {
  try {
    const base = process.env.INIT_CWD ?? process.cwd();
    const yaml = readFileSync(
      resolve(base, "mandates/fund-one.yaml"),
      "utf8",
    );
    return buildManagerPrompt(compileMandate(yaml).mandate);
  } catch {
    return "";
  }
}

function pickProposer(): Proposer {
  const which = process.env.PROPOSER ?? "RuleProposer";
  if (which === "LlmProposer") {
    return new LlmProposer({
      apiKey: process.env.LLM_API_KEY ?? "",
      baseUrl: process.env.LLM_BASE_URL,
      model: process.env.LLM_MODEL,
      systemPrompt: mandatePrompt() || undefined,
    });
  }
  return new RuleProposer();
}

function stateProvider(): FundStateProvider {
  // TODO: MirrorFundStateProvider once deployments.json has real addresses.
  return new MockFundStateProvider();
}

async function submitContext(envBody: ReturnType<typeof buildContextEnvelope>) {
  const operatorId = process.env.HEDERA_OPERATOR_ID;
  const operatorKey = process.env.HEDERA_OPERATOR_KEY;
  if (!operatorId || !operatorKey) {
    console.log(
      `[manager] CONTEXT (not submitted - no HEDERA_OPERATOR): ${JSON.stringify(envBody.body)}`,
    );
    return;
  }
  // Node-only import; kept dynamic so the edge-safe parts of this package
  // never pull in @hashgraph/sdk.
  const { hcsClient, submit } = await import("@indenture/hedera/hcs");
  const { readFileSync: rf } = await import("node:fs");
  const dep = JSON.parse(
    rf(resolve(process.cwd(), "../../contracts/deployments.json"), "utf8"),
  ) as { hcs: { journalTopicId: string } };
  if (!dep.hcs.journalTopicId) {
    console.log("[manager] CONTEXT not submitted - journalTopicId unset");
    return;
  }
  const client = hcsClient({ operatorId, operatorKey, network: "testnet" });
  const { sequenceNumber } = await submit(client, dep.hcs.journalTopicId, envBody);
  console.log(`[manager] CONTEXT -> journal seq ${sequenceNumber}`);
}

export async function tick(opts: { injected?: boolean } = {}): Promise<void> {
  let proposer = pickProposer();
  const state = await stateProvider().read();

  let proposal;
  try {
    proposal = await proposer.propose(state);
  } catch (e) {
    console.warn(
      `[manager] ${proposer.name} failed (${(e as Error).message}); falling back to RuleProposer`,
    );
    proposer = new RuleProposer();
    proposal = await proposer.propose(state);
  }

  console.log(`[manager] proposer=${proposer.name}`);
  console.log(`[manager] proposal=${JSON.stringify(proposal.swapParams)}`);
  console.log(`[manager] reasoning=${proposal.reasoning}`);

  await submitContext(
    buildContextEnvelope({
      vault: VAULT_MOCK,
      proposer: proposer.name,
      proposal,
      injected: opts.injected,
    }),
  );

  const validatorUrl = process.env.VALIDATOR_URL ?? "http://localhost:8787";
  const res = await fetch(`${validatorUrl}/validate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(validatorRequest(proposal)), // reasoning dropped here
  });
  const out = (await res.json()) as {
    decision?: string;
    reason?: string;
    receipt?: Parameters<typeof encodeReceiptBlob>[0];
    signature?: `0x${string}`;
  };

  if (out.decision !== "APPROVED" || !out.receipt || !out.signature) {
    console.log(`[manager] validator REFUSED: ${out.reason ?? "unknown"} - stopping`);
    return;
  }

  const blob = encodeReceiptBlob(out.receipt, out.signature);
  console.log(`[manager] APPROVED. receiptBlob=${blob.slice(0, 66)}…`);
  console.log(
    `[manager] would call vault.trade(key, params, receiptBlob) via MANAGER_KEY`,
  );
  // TODO: viem walletClient.writeContract IndentureVault.trade(...) on APPROVED.
}

if (process.argv.includes("--once")) {
  tick().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
