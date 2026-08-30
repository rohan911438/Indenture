import type { FundState, Proposal, Proposer } from "./proposer.js";

/**
 * Deterministic arithmetic fallback for when the LLM quota is exhausted.
 * Rebalances the single most-overweight asset back toward target. No network,
 * no model - always available. Flip PROPOSER=RuleProposer to force it.
 */
export class RuleProposer implements Proposer {
  readonly name = "RuleProposer";

  async propose(state: FundState): Promise<Proposal> {
    const entries = Object.entries(state.weights);
    const target = entries.length > 0 ? Math.floor(10_000 / (entries.length + 1)) : 0;

    let worstAsset = "";
    let worstOver = 0;
    for (const [asset, bps] of entries) {
      const over = bps - target;
      if (over > worstOver) {
        worstOver = over;
        worstAsset = asset;
      }
    }

    // Sell a slice of the overweight asset back to cash.
    const sliceBps = Math.min(worstOver, 500);
    return {
      poolId: state.poolId,
      swapParams: {
        zeroForOne: true, // asset -> quote
        amountSpecified: `-${sliceBps * 1_000_000}`, // placeholder sizing
        sqrtPriceLimitX96: "4295128740", // MIN_SQRT_RATIO + 1
      },
      reasoning: `RuleProposer: ${worstAsset || "n/a"} is ${worstOver}bps over target ${target}bps; trimming ${sliceBps}bps to cash.`,
    };
  }
}
