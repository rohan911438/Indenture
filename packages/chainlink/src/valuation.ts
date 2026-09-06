/**
 * Turning feed answers into a portfolio, in integers, without losing the plot
 * on decimals.
 *
 * Three different precisions meet here and none of them agree:
 *   the quote currency  (USDC on Hedera: 6dp)
 *   the risk asset      (typically 18dp)
 *   the Chainlink feed  (8dp for the USD pairs on Hedera)
 *
 * A wrong scale factor does not throw. It produces a plausible number and the
 * wrong decision — a position that looks like 25% when it is 25,000%, or a
 * covenant that never binds. That is why this is one small pure module with
 * its own tests rather than three lines inlined in each caller.
 *
 * Everything is bigint. No floats touch a number a covenant is compared to.
 */
import type { FeedReading } from "./aggregator.js";

export const BPS = 10_000n;

/** Move an integer between token decimal scales. */
export function scaleDecimals(value: bigint, fromDecimals: number, toDecimals: number): bigint {
  if (fromDecimals === toDecimals) return value;
  if (fromDecimals < toDecimals) return value * 10n ** BigInt(toDecimals - fromDecimals);
  return value / 10n ** BigInt(fromDecimals - toDecimals);
}

/**
 * Value a holding in quote units.
 *
 * @param balance       raw token units held
 * @param tokenDecimals the token's own decimals
 * @param reading       a VALIDATED feed reading — the type forces the caller to
 *                      have handled the fault case before it can price anything
 * @param quoteDecimals the decimals of the currency the answer is expressed in
 */
export function valueInQuote(
  balance: bigint,
  tokenDecimals: number,
  reading: Extract<FeedReading, { ok: true }>,
  quoteDecimals: number,
): bigint {
  // balance * price, then divide out the feed's own precision. Multiply first:
  // dividing first would floor small balances to zero.
  const priced = (balance * reading.answer) / 10n ** BigInt(reading.decimals);
  return scaleDecimals(priced, tokenDecimals, quoteDecimals);
}

export function bps(part: bigint, whole: bigint): bigint {
  if (whole <= 0n) return 0n;
  return (part * BPS) / whole;
}

export type Holding = {
  asset: string;
  balance: bigint;
  decimals: number;
  feed: string;
};

export type PortfolioOk = {
  ok: true;
  /** total value including cash, in quote units */
  navQuote: bigint;
  /** the quote-currency reserve, in quote units */
  cashQuote: bigint;
  /** asset -> value in quote units */
  valueOf: Record<string, bigint>;
  /** asset -> weight in bps of NAV */
  weightBps: Record<string, bigint>;
  cashBps: bigint;
  /** age of the OLDEST feed the portfolio depends on */
  oldestFeedAgeSec: number;
};

export type PortfolioFailure = {
  ok: false;
  /** the first feed that failed validation, and why */
  asset: string;
  failure: Extract<FeedReading, { ok: false }>;
};

export type Portfolio = PortfolioOk | PortfolioFailure;

/**
 * Reduce holdings + validated feed readings to a portfolio.
 *
 * Fails closed on the FIRST bad feed. A partial valuation is worse than no
 * valuation: it silently understates NAV, which inflates every weight and can
 * trip a covenant for a reason that has nothing to do with the trade. The
 * Validator's correct move when it cannot see a price is to refuse and say so.
 */
export function valuePortfolio(args: {
  cashQuote: bigint;
  holdings: Holding[];
  readings: Record<string, FeedReading>;
  quoteDecimals: number;
}): Portfolio {
  const valueOf: Record<string, bigint> = {};
  let nav = args.cashQuote;
  let oldest = 0;

  for (const h of args.holdings) {
    const reading = args.readings[h.asset.toLowerCase()] ?? args.readings[h.asset];
    if (!reading) {
      return {
        ok: false,
        asset: h.asset,
        failure: {
          ok: false,
          fault: "unreadable",
          reason: `no feed reading for ${h.asset}`,
          detail: { asset: h.asset },
        },
      };
    }
    if (!reading.ok) return { ok: false, asset: h.asset, failure: reading };

    const v = valueInQuote(h.balance, h.decimals, reading, args.quoteDecimals);
    valueOf[h.asset] = v;
    nav += v;
    if (reading.ageSec > oldest) oldest = reading.ageSec;
  }

  const weightBps: Record<string, bigint> = {};
  for (const [asset, v] of Object.entries(valueOf)) weightBps[asset] = bps(v, nav);

  return {
    ok: true,
    navQuote: nav,
    cashQuote: args.cashQuote,
    valueOf,
    weightBps,
    cashBps: bps(args.cashQuote, nav),
    oldestFeedAgeSec: oldest,
  };
}
