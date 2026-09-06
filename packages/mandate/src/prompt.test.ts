import { describe, it, expect } from "vitest";
import { compileMandate } from "./compile.js";
import { buildManagerPrompt } from "./prompt.js";

const YAML = `
version: 1
name: Fund One
vault: "0x00000000000000000000000000000000000000b0"
quote: "0x00000000000000000000000000000000000000c0"
covenants:
  maxPositionBps: 3000
  minCashBps: 1000
  maxTradeNotional: "250000000000"
  maxDailyNotional: "1000000000000"
  feedStaleAfterSec: 90000
universe:
  - "0x00000000000000000000000000000000000000d1"
  - "0x00000000000000000000000000000000000000d0"
priceFeeds:
  "0x00000000000000000000000000000000000000d0": "0x00000000000000000000000000000000000000e0"
  "0x00000000000000000000000000000000000000d1": "0x00000000000000000000000000000000000000e1"
`;

describe("buildManagerPrompt", () => {
  const { mandate } = compileMandate(YAML);

  it("is deterministic", () => {
    expect(buildManagerPrompt(mandate)).toBe(buildManagerPrompt(mandate));
  });

  it("names every covenant limit", () => {
    const p = buildManagerPrompt(mandate);
    expect(p).toContain("3000 bps");
    expect(p).toContain("1000 bps");
    expect(p).toContain("250000000000 quote units");
    expect(p).toContain("1000000000000 quote units");
  });

  it("lists the universe sorted, regardless of YAML order", () => {
    const p = buildManagerPrompt(mandate);
    const a = p.indexOf("0x00000000000000000000000000000000000000d0");
    const b = p.indexOf("0x00000000000000000000000000000000000000d1");
    expect(a).toBeGreaterThan(-1);
    expect(b).toBeGreaterThan(a);
  });

  it("is surfaced on the CompiledMandate", () => {
    expect(compileMandate(YAML).prompt).toBe(buildManagerPrompt(mandate));
  });
});
