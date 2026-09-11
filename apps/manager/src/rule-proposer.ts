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
    const equalWeight = entries.length > 0 ? Math.floor(10_000 / (entries.length + 1)) : 0;

    // Never aim above what the mandate allows. An equal-weight target of
    // 5000bps against a 3000bps position covenant means every proposal is
    // refused for maxPositionBps, and the fallback that is supposed to always
    // work never produces an executable trade. Aim at the covenant when the
    // covenant is tighter, so the post-trade state is one the hook accepts.
    const cap = state.maxPositionBps ?? 10_000;
    const target = Math.min(equalWeight, cap);

    let worstAsset = "";
    let worstOver = 0;
    for (const [asset, bps] of entries) {
      const over = bps - target;
      if (over > worstOver) {
        worstOver = over;
        worstAsset = asset;
      }
    }

    // Size the trade to close the gap, in quote units, rather than guess.
    const nav = BigInt(state.navQuote ?? "0");
    let notional = (BigInt(worstOver) * nav) / 10_000n;

    // The per-trade cap can make the gap uncloseable in one trade. Clamping
    // is right, and so is saying so: a proposal that pretends to reach target
    // and lands short would look like the covenant maths is broken.
    const perTrade = state.maxTradeNotional ? BigInt(state.maxTradeNotional) : null;
    const clamped = perTrade !== null && notional > perTrade;
    if (clamped) notional = perTrade!;

    // Convert the quote-denominated gap into INPUT TOKEN units, which is what
    // amountSpecified means. Done as a proportion of the position rather than
    // through the price, so no decimal scaling can drift: to remove X of Y
    // quote units of value, sell X/Y of the balance.
    const position = worstAsset ? state.positions?.[worstAsset] : undefined;
    let amount = notional;
    if (position) {
      const value = BigInt(position.valueQuote);
      amount = value > 0n ? (BigInt(position.balance) * notional) / value : 0n;
    }

    // Selling the asset means swapping towards the quote. Whether that is
    // zeroForOne depends on which side of the pair v4 put the cash.
    const zeroForOne = !(state.quoteIsCurrency0 ?? false);

    const reach = clamped ? "partially closing" : "closing";
    return {
      poolId: state.poolId,
      swapParams: {
        zeroForOne,
        amountSpecified: `-${amount.toString()}`, // exact input, asset units
        sqrtPriceLimitX96: zeroForOne ? "4295128740" : "1461446703485210103287273052203988822378723970341",
      },
      reasoning: worstAsset
        ? `RuleProposer: ${worstAsset} is ${worstOver}bps over target ${target}bps; selling ${amount} asset units (${notional} quote units of value) to cash, ${reach} the gap.`
        : `RuleProposer: nothing is over target ${target}bps; no trade.`,
    };
  }
}
