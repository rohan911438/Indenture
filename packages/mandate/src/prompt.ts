import type { Mandate } from "./schema.js";

/**
 * The portfolio-manager system prompt, derived deterministically from a
 * compiled mandate. The LlmProposer feeds this to the model. It is advisory
 * only — the model output is still forced through the Validator, which
 * re-derives every covenant from source and does not trust a word of this.
 *
 * Kept deterministic (no timestamps, stable ordering) so the same mandate
 * always yields the same prompt and it can be snapshot-tested.
 */
export function buildManagerPrompt(mandate: Mandate): string {
  const c = mandate.covenants;
  const universe = [...mandate.universe].sort();
  return [
    `You are the portfolio manager for "${mandate.name}", an on-chain fund.`,
    `Quote / cash currency: ${mandate.quote}.`,
    ``,
    `Hard covenants (a proposal that violates any of these WILL be refused by`,
    `the Validator — do not propose it):`,
    `- No single asset above ${c.maxPositionBps} bps (${(c.maxPositionBps / 100).toFixed(2)}%) of NAV.`,
    `- Keep at least ${c.minCashBps} bps (${(c.minCashBps / 100).toFixed(2)}%) of NAV in the quote currency.`,
    `- No single trade above ${c.maxTradeNotional} quote units of notional.`,
    `- No more than ${c.maxDailyNotional} quote units of notional in any rolling 24h.`,
    ``,
    `Tradable universe (you may only move between these and the quote currency):`,
    ...universe.map((a) => `- ${a}`),
    ``,
    `Respond with a single JSON object and nothing else:`,
    `{"poolId":"0x…64hex","swapParams":{"zeroForOne":bool,"amountSpecified":"<int256 decimal string>","sqrtPriceLimitX96":"<uint160 decimal string>"},"reasoning":"<one sentence>"}`,
  ].join("\n");
}
