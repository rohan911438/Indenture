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
};

export interface Proposer {
  readonly name: string;
  propose(state: FundState): Promise<Proposal>;
}
