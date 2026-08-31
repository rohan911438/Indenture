import { describe, it, expect } from "vitest";
import { LlmProposer } from "./llm-proposer.js";
import type { FundState } from "./proposer.js";

const STATE: FundState = {
  poolId: "0x" + "2".repeat(64),
  weights: { "0x00000000000000000000000000000000000000d0": 2500 },
  cashBps: 4000,
  prices: {},
};

function fakeFetch(content: string, ok = true): typeof fetch {
  return (async () =>
    new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
      status: ok ? 200 : 500,
    })) as unknown as typeof fetch;
}

describe("LlmProposer", () => {
  it("throws without an api key", async () => {
    await expect(new LlmProposer("").propose(STATE)).rejects.toThrow(
      /LLM_API_KEY/,
    );
  });

  it("parses a well-formed JSON proposal", async () => {
    const good = JSON.stringify({
      poolId: "0x" + "2".repeat(64),
      swapParams: {
        zeroForOne: true,
        amountSpecified: "-1000000",
        sqrtPriceLimitX96: "4295128740",
      },
      reasoning: "trim the overweight asset",
    });
    const p = new LlmProposer({ apiKey: "k", fetchImpl: fakeFetch(good) });
    const out = await p.propose(STATE);
    expect(out.swapParams.zeroForOne).toBe(true);
    expect(out.reasoning).toContain("trim");
  });

  it("throws on non-JSON model output (caller falls back)", async () => {
    const p = new LlmProposer({
      apiKey: "k",
      fetchImpl: fakeFetch("sure! here you go: buy everything"),
    });
    await expect(p.propose(STATE)).rejects.toThrow(/not JSON/);
  });

  it("throws on JSON that fails the strict schema", async () => {
    const p = new LlmProposer({
      apiKey: "k",
      fetchImpl: fakeFetch(JSON.stringify({ poolId: "nope" })),
    });
    await expect(p.propose(STATE)).rejects.toThrow(/schema/);
  });

  it("throws on an HTTP error", async () => {
    const p = new LlmProposer({
      apiKey: "k",
      fetchImpl: fakeFetch("{}", false),
    });
    await expect(p.propose(STATE)).rejects.toThrow(/LLM 500/);
  });
});
