/**
 * The Manager is untrusted by design. Its only job is to produce a Proposal;
 * everything downstream (Validator, hook) assumes it may be fully compromised.
 *
 * A Proposal is JUST {poolId, swapParams} plus free-text reasoning that is
 * journaled as CONTEXT but is NEVER forwarded to the Validator.
 */

export type SwapParams = {
  zeroForOne: boolean;
  amountSpecified: string; // int256 decimal string
  sqrtPriceLimitX96: string; // uint160 decimal string
};

export type Proposal = {
  poolId: string;
  swapParams: SwapParams;
  reasoning: string; // journaled as CONTEXT only
};

export type FundState = {
  poolId: string;
  /** asset -> weight in bps, from the mirror node */
  weights: Record<string, number>;
  cashBps: number;
  /** asset -> reference price, from the mirror node's view of the feeds */
  prices: Record<string, number>;
  /**
   * Total NAV in quote units, as a decimal string. Without it a proposer can
   * say WHICH way to trade but not how much, and a size pulled out of the air
   * is the difference between a trade the hook executes and one it reverts.
   */
  navQuote?: string;
  /**
   * The covenants the Validator will judge the proposal against.
   *
   * A proposer that does not know them will happily aim at an allocation the
   * mandate forbids, and every proposal it makes is refused for a reason it
   * cannot see. That is not a safety problem — the refusal is correct — but a
   * fallback proposer that can never produce an executable trade is not a
   * fallback. These are advisory: the Validator re-derives both from the
   * mandate and never trusts what is passed here.
   */
  maxPositionBps?: number;
  /** Per-trade cap in quote units, decimal string. */
  maxTradeNotional?: string;
  /**
   * Which side of the pool the cash is on. Decides the direction flag: to
   * sell the asset you swap towards the quote, and whether that is
   * `zeroForOne` depends entirely on the ordering v4 gave the pair.
   */
  quoteIsCurrency0?: boolean;
  /**
   * asset -> its raw token balance and what that balance is worth in quote
   * units. Both, because `amountSpecified` is denominated in the INPUT TOKEN
   * and the covenants are denominated in quote. Sizing a sell in quote units
   * and handing it to a pool that reads it as 18dp asset units produces a
   * trade of effectively zero that still costs gas, and a refusal whose
   * arithmetic looks correct because it is: nothing moved.
   */
  positions?: Record<string, { balance: string; valueQuote: string }>;
};

export interface Proposer {
  readonly name: string;
  propose(state: FundState): Promise<Proposal>;
}
