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
