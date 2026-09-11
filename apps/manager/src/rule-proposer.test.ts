import { describe, it, expect } from "vitest";
import { RuleProposer } from "./rule-proposer.js";

describe("RuleProposer", () => {
  it("targets the most-overweight asset", async () => {
    const p = new RuleProposer();
    const proposal = await p.propose({
      poolId: "0x" + "2".repeat(64),
      weights: {
        "0x00000000000000000000000000000000000000d0": 6000,
        "0x00000000000000000000000000000000000000d1": 1000,
      },
      cashBps: 3000,
      prices: {},
    });
    expect(proposal.swapParams.zeroForOne).toBe(true);
    expect(proposal.reasoning).toContain("0x00000000000000000000000000000000000000d0");
  });

  it("is deterministic", async () => {
    const p = new RuleProposer();
    const state = {
      poolId: "0x" + "2".repeat(64),
      weights: { "0x00000000000000000000000000000000000000d0": 4200 },
      cashBps: 5800,
      prices: {},
    };
    expect(await p.propose(state)).toEqual(await p.propose(state));
  });
});

/**
 * The first live tick on testnet produced a zero-size proposal, and the one
 * before it would have been refused for maxPositionBps no matter what. Both
 * came from the same thing: a proposer that did not know the covenants it was
 * being judged against.
 */
describe("RuleProposer inside the covenants", () => {
  const ASSET = "0x00000000000000000000000000000000000000d0";
  const NAV = "1000000000000"; // 1,000,000 USDC at 6dp

  const state = (weightBps: number, extra: Record<string, unknown> = {}) => ({
    poolId: `0x${"2".repeat(64)}`,
    weights: { [ASSET]: weightBps },
    cashBps: 10_000 - weightBps,
    prices: {},
    navQuote: NAV,
    maxPositionBps: 3000,
    ...extra,
  });

  it("aims at the position covenant, not at equal weight", async () => {
    // Equal weight for one asset is 5000bps. The mandate caps the position at
    // 3000. Aiming at 5000 leaves the fund in breach and the trade refused.
    const p = await new RuleProposer().propose(state(4000));
    // 1000bps of a 1,000,000 NAV = 100,000 USDC.
    expect(p.swapParams.amountSpecified).toBe("-100000000000");
    expect(p.reasoning).toContain("target 3000bps");
  });

  it("proposes nothing when the position is already inside the cap", async () => {
    const p = await new RuleProposer().propose(state(2000));
    expect(p.swapParams.amountSpecified).toBe("-0");
    expect(p.reasoning).toContain("no trade");
  });

  it("clamps to the per-trade cap and says the gap is only partly closed", async () => {
    // 6000bps over on a 1,000,000 NAV wants 600,000 USDC, but the mandate
    // allows 250,000 per trade. Landing short is correct; pretending
    // otherwise would make the covenant maths look broken.
    const p = await new RuleProposer().propose(
      state(9000, { maxTradeNotional: "250000000000" }),
    );
    expect(p.swapParams.amountSpecified).toBe("-250000000000");
    expect(p.reasoning).toContain("partially closing");
  });

  it("falls back to equal weight when no covenant is supplied", async () => {
    const p = await new RuleProposer().propose({
      poolId: `0x${"2".repeat(64)}`,
      weights: { [ASSET]: 6000 },
      cashBps: 4000,
      prices: {},
      navQuote: NAV,
    });
    expect(p.reasoning).toContain("target 5000bps");
  });

  it("sells the asset for cash, never the reverse", async () => {
    // The only direction this proposer is allowed to take. A fallback that
    // could buy would be a fallback that can increase a breach.
    expect((await new RuleProposer().propose(state(9000))).swapParams.zeroForOne).toBe(true);
  });
});

/**
 * `amountSpecified` is denominated in the INPUT TOKEN, not in the quote. The
 * first live tick sized a sell in quote units against a pool whose currency0
 * is an 18dp asset, so the pool saw a trade of effectively nothing, the
 * position did not move, and the Validator refused with arithmetic that was
 * correct about a trade that would have done nothing at all.
 */
describe("RuleProposer trade sizing", () => {
  const ASSET = "0x00000000000000000000000000000000000000d0";

  const overweight = {
    poolId: `0x${"2".repeat(64)}`,
    weights: { [ASSET]: 4000 },
    cashBps: 6000,
    prices: {},
    navQuote: "1000000000000", // 1,000,000 USDC at 6dp
    maxPositionBps: 3000,
    // 400,000 USDC of value held as 5,000,000 whole tokens at 18dp
    positions: {
      [ASSET]: { balance: (5_000_000n * 10n ** 18n).toString(), valueQuote: "400000000000" },
    },
  };

  it("sizes the sell in asset units, not quote units", async () => {
    // Shed 100,000 USDC of a 400,000 USDC position: a quarter of the balance.
    const p = await new RuleProposer().propose(overweight);
    expect(p.swapParams.amountSpecified).toBe(`-${(1_250_000n * 10n ** 18n).toString()}`);
  });

  it("sells towards the quote when the asset is currency0", async () => {
    const p = await new RuleProposer().propose({ ...overweight, quoteIsCurrency0: false });
    expect(p.swapParams.zeroForOne).toBe(true);
  });

  it("flips the direction when the quote is currency0", async () => {
    // Same intent, opposite flag. Getting this from the pair ordering rather
    // than hardcoding it is the whole point.
    const p = await new RuleProposer().propose({ ...overweight, quoteIsCurrency0: true });
    expect(p.swapParams.zeroForOne).toBe(false);
  });

  it("does not divide by a position worth nothing", async () => {
    const p = await new RuleProposer().propose({
      ...overweight,
      positions: { [ASSET]: { balance: "1000", valueQuote: "0" } },
    });
    expect(p.swapParams.amountSpecified).toBe("-0");
  });

  it("still sizes in quote units when no position detail is supplied", async () => {
    const { positions, ...withoutPositions } = overweight;
    const p = await new RuleProposer().propose(withoutPositions);
    expect(p.swapParams.amountSpecified).toBe("-100000000000");
  });
});
