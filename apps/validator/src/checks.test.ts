import { describe, it, expect } from "vitest";
import { runCovenantChecks, type CovenantInputs } from "./checks.js";

const base: CovenantInputs = {
  limits: {
    maxPositionBps: 3000n,
    minCashBps: 1000n,
    maxTradeNotional: 250_000_000_000n,
    maxDailyNotional: 1_000_000_000_000n,
  },
  boughtAsset: "0x00000000000000000000000000000000000000d0",
  inUniverse: true,
  tradeNotionalQuote: 100_000_000_000n,
  priorDailyNotionalQuote: 0n,
  navQuote: 1_000_000_000_000n,
  postTradeCashQuote: 200_000_000_000n, // 2000bps
  postTradePositionQuote: 250_000_000_000n, // 2500bps
  oldestFeedAgeSec: 10,
  feedStaleAfterSec: 3600,
};

describe("runCovenantChecks", () => {
  it("approves a compliant trade", () => {
    const r = runCovenantChecks(base);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.snapshot.positionBps).toBe("2500");
  });

  it("refuses a stale feed before anything else", () => {
    const r = runCovenantChecks({
      ...base,
      oldestFeedAgeSec: 5000,
      inUniverse: false, // would also fail, but staleness is checked first
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.covenant).toBe("feedStaleness");
  });

  it("refuses an asset outside the universe", () => {
    const r = runCovenantChecks({ ...base, inUniverse: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.covenant).toBe("assetNotInUniverse");
  });

  it("refuses an oversized single trade", () => {
    const r = runCovenantChecks({ ...base, tradeNotionalQuote: 250_000_000_001n });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.covenant).toBe("maxTradeNotional");
  });

  it("refuses when the rolling 24h cap would be crossed", () => {
    const r = runCovenantChecks({
      ...base,
      priorDailyNotionalQuote: 950_000_000_000n,
      tradeNotionalQuote: 100_000_000_000n,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.covenant).toBe("maxDailyNotional");
  });

  it("refuses when a position would exceed maxPositionBps", () => {
    const r = runCovenantChecks({ ...base, postTradePositionQuote: 300_100_000_001n });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.covenant).toBe("maxPositionBps");
      expect(r.detail.limitBps).toBe("3000");
    }
  });

  it("refuses when cash would fall below minCashBps", () => {
    const r = runCovenantChecks({ ...base, postTradeCashQuote: 99_000_000_000n });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.covenant).toBe("minCashBps");
  });

  // Regression: docs/RESEARCH.md section 2.1. Chainlink's Hedera feeds beat
  // every 86400s, so a feed can legitimately be a full day old. The tolerance
  // used to be a hardcoded 3600s, and staleness is the FIRST check, so the
  // Validator would have refused nearly every proposal for a healthy feed —
  // a failure that only appears once the mocks come out.
  it("accepts a feed that is one full Chainlink heartbeat old", () => {
    const r = runCovenantChecks({
      ...base,
      oldestFeedAgeSec: 86_400,
      feedStaleAfterSec: 90_000, // the mandate's value
    });
    expect(r.ok).toBe(true);
  });

  it("still refuses a feed past the mandate's tolerance", () => {
    const r = runCovenantChecks({
      ...base,
      oldestFeedAgeSec: 90_001,
      feedStaleAfterSec: 90_000,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.covenant).toBe("feedStaleness");
  });

  it("is deterministic", () => {
    expect(runCovenantChecks(base)).toEqual(runCovenantChecks(base));
  });
});
