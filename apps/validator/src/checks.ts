/**
 * The covenant checks. PURE arithmetic over a reduced snapshot - everything is
 * already priced in quote units by the time it gets here. No network, no env,
 * no request parsing. This is what makes the Validator's decision auditable:
 * the same inputs always give the same decision + reason.
 *
 * Order matters and matches shared-contracts/validator-api.md:
 *   feedStaleness -> assetNotInUniverse -> maxTradeNotional
 *   -> maxDailyNotional -> maxPositionBps -> minCashBps
 */

export type CovenantLimits = {
  maxPositionBps: bigint;
  minCashBps: bigint;
  maxTradeNotional: bigint;
  maxDailyNotional: bigint;
};

export type CovenantInputs = {
  limits: CovenantLimits;
  /** the asset this trade increases exposure to */
  boughtAsset: string;
  /** is `boughtAsset` in the mandate universe (or the quote currency)? */
  inUniverse: boolean;
  /** notional of THIS trade, quote units */
  tradeNotionalQuote: bigint;
  /** notional already executed in the trailing 24h, quote units (from the journal) */
  priorDailyNotionalQuote: bigint;
  /** total fund NAV after the trade, quote units */
  navQuote: bigint;
  /** quote-currency reserve after the trade, quote units */
  postTradeCashQuote: bigint;
  /** value of `boughtAsset` after the trade, quote units */
  postTradePositionQuote: bigint;
  /** age of the oldest price feed this trade depends on, seconds */
  oldestFeedAgeSec: number;
  /** mandate staleness tolerance, seconds */
  feedStaleAfterSec: number;
  /**
   * Set when a feed failed validation for a reason that is NOT age: an
   * incomplete round, an answer carried over from a previous round, a
   * non-positive price, or an unreachable feed. See @indenture/chainlink.
   *
   * Kept distinct from staleness because the journal is the product. "the
   * feed reported a negative price" and "the feed is 3 hours old" are
   * different events for anyone auditing why a trade did not happen, and
   * collapsing both into a staleness message would be a small lie told
   * permanently, on chain.
   */
  feedFault?: { fault: string; reason: string; detail: Record<string, string> };
};

export type CheckOk = { ok: true; snapshot: Record<string, string> };
export type CheckRefusal = {
  ok: false;
  covenant:
    | "feedUnusable"
    | "feedStaleness"
    | "assetNotInUniverse"
    | "maxTradeNotional"
    | "maxDailyNotional"
    | "maxPositionBps"
    | "minCashBps";
  reason: string;
  detail: Record<string, string>;
};
export type CheckResult = CheckOk | CheckRefusal;

const BPS = 10_000n;

function bps(part: bigint, whole: bigint): bigint {
  if (whole <= 0n) return 0n;
  return (part * BPS) / whole;
}

export function runCovenantChecks(i: CovenantInputs): CheckResult {
  // 0. feed integrity - a price that failed validation is not a price. This
  //    is checked before staleness because "the round never completed" is a
  //    stronger and more specific statement than "it is old".
  if (i.feedFault) {
    return {
      ok: false,
      covenant: "feedUnusable",
      reason: i.feedFault.reason,
      detail: { fault: i.feedFault.fault, ...i.feedFault.detail },
    };
  }

  // 1. staleness - the Validator simply refuses; the hook never sees this.
  if (i.oldestFeedAgeSec > i.feedStaleAfterSec) {
    return {
      ok: false,
      covenant: "feedStaleness",
      reason: `price feed is ${i.oldestFeedAgeSec}s old, tolerance is ${i.feedStaleAfterSec}s`,
      detail: {
        observedAgeSec: String(i.oldestFeedAgeSec),
        toleranceSec: String(i.feedStaleAfterSec),
      },
    };
  }

  // 2. universe
  if (!i.inUniverse) {
    return {
      ok: false,
      covenant: "assetNotInUniverse",
      reason: `asset ${i.boughtAsset} is not in the mandate universe`,
      detail: { asset: i.boughtAsset },
    };
  }

  // 3. per-trade notional
  if (i.tradeNotionalQuote > i.limits.maxTradeNotional) {
    return {
      ok: false,
      covenant: "maxTradeNotional",
      reason: `trade notional ${i.tradeNotionalQuote} exceeds cap ${i.limits.maxTradeNotional}`,
      detail: {
        observed: String(i.tradeNotionalQuote),
        limit: String(i.limits.maxTradeNotional),
      },
    };
  }

  // 4. rolling 24h notional
  const dailyAfter = i.priorDailyNotionalQuote + i.tradeNotionalQuote;
  if (dailyAfter > i.limits.maxDailyNotional) {
    return {
      ok: false,
      covenant: "maxDailyNotional",
      reason: `24h notional would reach ${dailyAfter}, exceeds cap ${i.limits.maxDailyNotional}`,
      detail: {
        prior: String(i.priorDailyNotionalQuote),
        thisTrade: String(i.tradeNotionalQuote),
        wouldReach: String(dailyAfter),
        limit: String(i.limits.maxDailyNotional),
      },
    };
  }

  // 5. single-asset weight
  const positionBps = bps(i.postTradePositionQuote, i.navQuote);
  if (positionBps > i.limits.maxPositionBps) {
    return {
      ok: false,
      covenant: "maxPositionBps",
      reason: `asset would reach ${positionBps}bps > ${i.limits.maxPositionBps}bps cap`,
      detail: {
        observedBps: String(positionBps),
        limitBps: String(i.limits.maxPositionBps),
      },
    };
  }

  // 6. cash floor
  const cashBps = bps(i.postTradeCashQuote, i.navQuote);
  if (cashBps < i.limits.minCashBps) {
    return {
      ok: false,
      covenant: "minCashBps",
      reason: `cash reserve would fall to ${cashBps}bps < ${i.limits.minCashBps}bps floor`,
      detail: {
        observedBps: String(cashBps),
        floorBps: String(i.limits.minCashBps),
      },
    };
  }

  return {
    ok: true,
    snapshot: {
      tradeNotionalQuote: String(i.tradeNotionalQuote),
      dailyNotionalAfter: String(dailyAfter),
      positionBps: String(positionBps),
      cashBps: String(cashBps),
      oldestFeedAgeSec: String(i.oldestFeedAgeSec),
    },
  };
}
