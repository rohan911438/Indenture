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
import {
  MockFundStateProvider,
  MirrorFundStateProvider,
  type FundStateProvider,
} from "./fund-state.js";
import {
  buildContextEnvelope,
  encodeReceiptBlob,
  validatorRequest,
} from "./context.js";
import { submitTrade, type PoolConfig } from "./trade.js";
import type { Hex } from "viem";

const VAULT_MOCK = "0x00000000000000000000000000000000000000b0";

type DeploymentsFile = {
  network?: { rpcUrl?: string; chainId?: number };
  contracts?: Record<string, string>;
  pool?: { currency0?: string; currency1?: string; fee?: number; tickSpacing?: number };
  hcs?: Record<string, string>;
};

/** deployments.json is the single source of truth. Never read an address from env. */
function loadDeployments(): DeploymentsFile {
  try {
    const base = process.env.INIT_CWD ?? process.cwd();
    return JSON.parse(
      readFileSync(resolve(base, "contracts/deployments.json"), "utf8"),
    ) as DeploymentsFile;
  } catch {
    try {
      return JSON.parse(
        readFileSync(resolve(process.cwd(), "../../contracts/deployments.json"), "utf8"),
      ) as DeploymentsFile;
    } catch {
      return {};
    }
  }
}

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

/**
 * mock-status.md row 6. Switches on the DATA, like the Validator's own seam:
 * if deployments.json has no addresses there is genuinely nothing to read.
 *
 * Being wrong here is cheap — this view is advisory and the Validator
 * re-derives everything independently — so it falls back quietly rather than
 * failing the tick.
 */
function stateProvider(): FundStateProvider {
  const dep = loadDeployments();
  const vault = dep.contracts?.IndentureVault;
  const poolId = (dep.pool as { poolId?: string } | undefined)?.poolId;
  if (!vault || !poolId) return new MockFundStateProvider();

  try {
    const base = process.env.INIT_CWD ?? process.cwd();
    const yaml = readFileSync(resolve(base, "mandates/fund-one.yaml"), "utf8");
    const compiled = compileMandate(yaml);
    return new MirrorFundStateProvider({
      rpcUrl: dep.network?.rpcUrl ?? "https://testnet.hashio.io/api",
      poolId,
      vault: vault as Hex,
      quote: compiled.mandate.quote as Hex,
      priceFeeds: compiled.mandate.priceFeeds,
      feedStaleAfterSec: compiled.feedStaleAfterSec,
    });
  } catch {
    return new MockFundStateProvider();
  }
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

  // --- submit on chain -----------------------------------------------------
  const dep = loadDeployments();
  const vault = dep.contracts?.IndentureVault;
  const hooks = dep.contracts?.PolicyHook;
  const managerKey = process.env.MANAGER_KEY;

  if (!vault || !hooks || !dep.pool?.currency0 || !dep.pool?.currency1) {
    console.log("[manager] deployments.json not populated - not submitting");
    return;
  }
  if (!managerKey) {
    console.log("[manager] MANAGER_KEY not set - not submitting");
    return;
  }

  const pool: PoolConfig = {
    currency0: dep.pool.currency0 as Hex,
    currency1: dep.pool.currency1 as Hex,
    fee: dep.pool.fee ?? 3000,
    tickSpacing: dep.pool.tickSpacing ?? 60,
    hooks: hooks as Hex,
  };

  try {
    const hash = await submitTrade({
      vault: vault as Hex,
      pool,
      swapParams: proposal.swapParams,
      receiptBlob: blob,
      privateKey: managerKey as Hex,
      rpcUrl: dep.network?.rpcUrl ?? "https://testnet.hashio.io/api",
      chainId: dep.network?.chainId ?? 296,
    });
    console.log(`[manager] vault.trade submitted: ${hash}`);
  } catch (e) {
    // A revert here is a SUCCESS for the product, not a crash: it means the
    // hook refused a trade the Validator had already signed. Log it plainly
    // and let the journaler pick the refusal up from chain.
    const firstLine = (e as Error).message.split("\n")[0];
    console.log(`[manager] vault.trade reverted: ${firstLine}`);
  }
}

if (process.argv.includes("--once")) {
  tick().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
