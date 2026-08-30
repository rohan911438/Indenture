import type { FundState, Proposal, Proposer } from "./proposer.js";

/**
 * LLM-backed proposer. Bring your own free-tier key (LLM_API_KEY). The model
 * output is parsed into {poolId, swapParams} + reasoning; malformed output
 * throws and the caller falls back to RuleProposer.
 *
 * SECURITY NOTE: this component is assumed compromised. Nothing here is
 * trusted. The prompt, the model, and the key can all be adversarial - the
 * Validator and hook are what actually protect the fund.
 */
export class LlmProposer implements Proposer {
  readonly name = "LlmProposer";

  constructor(private readonly apiKey: string) {}

  async propose(state: FundState): Promise<Proposal> {
    if (!this.apiKey) throw new Error("LLM_API_KEY not set");
    // TODO: call the model with a portfolio-manager system prompt + `state`,
    //       parse a strict JSON block, validate shape, return it.
    void state;
    throw new Error("LlmProposer not implemented - set PROPOSER=RuleProposer");
  }
}
