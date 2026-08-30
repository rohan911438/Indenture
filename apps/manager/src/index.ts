/**
 * One tick of the Manager:
 *   1. read fund state from the mirror node
 *   2. ask the configured Proposer for a {poolId, swapParams} proposal
 *   3. POST exactly {poolId, swapParams} to the Validator
 *   4. on APPROVED: submit trade() to the vault with the signed receipt blob
 *   5. journal the raw proposal + reasoning as CONTEXT (never sent to Validator)
 *
 * Runs under GitHub Actions cron (agent-tick.yml) with workflow_dispatch so it
 * can be triggered live on stage.
 */
import type { FundState, Proposer } from "./proposer.js";
import { RuleProposer } from "./rule-proposer.js";
import { LlmProposer } from "./llm-proposer.js";

function pickProposer(): Proposer {
  const which = process.env.PROPOSER ?? "RuleProposer";
  if (which === "LlmProposer") return new LlmProposer(process.env.LLM_API_KEY ?? "");
  return new RuleProposer();
}

async function readFundState(): Promise<FundState> {
  // TODO: pull weights / cash / prices from the mirror node using
  //       deployments.json addresses. Stubbed for scaffold.
  return {
    poolId: "0x" + "2".repeat(64),
    weights: { "0x00000000000000000000000000000000000000d0": 4200 },
    cashBps: 5800,
    prices: { "0x00000000000000000000000000000000000000d0": 100 },
  };
}

export async function tick(): Promise<void> {
  const proposer = pickProposer();
  const state = await readFundState();
  const proposal = await proposer.propose(state);

  console.log(`[manager] proposer=${proposer.name}`);
  console.log(`[manager] proposal=${JSON.stringify(proposal.swapParams)}`);
  console.log(`[manager] reasoning=${proposal.reasoning}`);

  const validatorUrl = process.env.VALIDATOR_URL ?? "http://localhost:8787";
  const res = await fetch(`${validatorUrl}/validate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    // EXACTLY {poolId, swapParams}. Reasoning is deliberately dropped here.
    body: JSON.stringify({ poolId: proposal.poolId, swapParams: proposal.swapParams }),
  });
  const out = await res.json();
  console.log(`[manager] validator -> ${JSON.stringify(out).slice(0, 400)}`);

  // TODO: journal CONTEXT via the journaler; on APPROVED, call vault.trade().
}

if (process.argv.includes("--once")) {
  tick().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
