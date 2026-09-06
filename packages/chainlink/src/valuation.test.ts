import { describe, it, expect } from "vitest";
import { scaleDecimals, valueInQuote, valuePortfolio, bps } from "./valuation.js";
import type { FeedReading } from "./aggregator.js";

const ok = (answer: bigint, decimals = 8, ageSec = 30): Extract<FeedReading, { ok: true }> => ({
  ok: true,
  answer,
  decimals,
  updatedAt: 0,
  ageSec,
  roundId: 1n,
});

const ONE_DOLLAR = ok(100_000_000n); // $1.00 at 8dp

describe("scaleDecimals", () => {
  it("scales up, down, and not at all", () => {
    expect(scaleDecimals(1n, 6, 18)).toBe(1_000_000_000_000n);
    expect(scaleDecimals(1_000_000_000_000n, 18, 6)).toBe(1n);
    expect(scaleDecimals(42n, 8, 8)).toBe(42n);
  });
});

describe("valueInQuote", () => {
  it("values an 18dp asset through an 8dp feed into 6dp quote units", () => {
    // 250,000 tokens at $1 = 250,000 USDC
    expect(valueInQuote(250_000n * 10n ** 18n, 18, ONE_DOLLAR, 6)).toBe(250_000_000_000n);
  });

  it("handles a non-unit price", () => {
    // 10 tokens at $2,500 = 25,000 USDC
    const at2500 = ok(2_500n * 10n ** 8n);
    expect(valueInQuote(10n * 10n ** 18n, 18, at2500, 6)).toBe(25_000_000_000n);
  });

  it("multiplies before dividing so small balances do not floor to zero", () => {
    // 1 wei of an 18dp token at $2,500. Dividing by the feed precision first
    // would floor the whole thing to zero before the price was ever applied.
    const at2500 = ok(2_500n * 10n ** 8n);
    expect(valueInQuote(1n, 18, at2500, 18)).toBe(2_500n);
  });
});

describe("valuePortfolio", () => {
  const holdings = [
    { asset: "0xaa", balance: 250_000n * 10n ** 18n, decimals: 18, feed: "0xf1" },
  ];

  it("computes NAV, weights and the cash floor in bps", () => {
    const p = valuePortfolio({
      cashQuote: 750_000_000_000n, // 750,000 USDC
      holdings,
      readings: { "0xaa": ONE_DOLLAR },
      quoteDecimals: 6,
    });
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.navQuote).toBe(1_000_000_000_000n); // 1,000,000 USDC
    expect(p.weightBps["0xaa"]).toBe(2500n); // 25%
    expect(p.cashBps).toBe(7500n);
  });

  it("reports the OLDEST feed age, not the newest", () => {
    // The portfolio is only as fresh as its stalest input; taking the newest
    // would let one recently-updated feed vouch for a portfolio priced mostly
    // from stale ones.
    const p = valuePortfolio({
      cashQuote: 0n,
      holdings: [
        { asset: "0xaa", balance: 10n ** 18n, decimals: 18, feed: "0xf1" },
        { asset: "0xbb", balance: 10n ** 18n, decimals: 18, feed: "0xf2" },
      ],
      readings: { "0xaa": ok(100_000_000n, 8, 12), "0xbb": ok(100_000_000n, 8, 4_000) },
      quoteDecimals: 6,
    });
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.oldestFeedAgeSec).toBe(4_000);
  });

  it("fails closed on the first bad feed rather than valuing a partial book", () => {
    // A partial valuation silently understates NAV, which inflates every
    // weight and can trip a covenant for a reason unrelated to the trade.
    const p = valuePortfolio({
      cashQuote: 750_000_000_000n,
      holdings,
      readings: {
        "0xaa": { ok: false, fault: "stale", reason: "too old", detail: {} },
      },
      quoteDecimals: 6,
    });
    expect(p.ok).toBe(false);
    if (!p.ok) {
      expect(p.asset).toBe("0xaa");
      expect(p.failure.fault).toBe("stale");
    }
  });

  it("fails closed when a holding has no feed at all", () => {
    const p = valuePortfolio({
      cashQuote: 0n,
      holdings,
      readings: {},
      quoteDecimals: 6,
    });
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.failure.fault).toBe("unreadable");
  });
});

describe("bps", () => {
  it("is zero when NAV is zero rather than dividing by it", () => {
    expect(bps(1n, 0n)).toBe(0n);
  });
});
