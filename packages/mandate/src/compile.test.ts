import { describe, it, expect } from "vitest";
import { compileMandate } from "./compile.js";

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
universe:
  - "0x00000000000000000000000000000000000000d0"
  - "0x00000000000000000000000000000000000000d1"
priceFeeds:
  "0x00000000000000000000000000000000000000d0": "0x00000000000000000000000000000000000000e0"
  "0x00000000000000000000000000000000000000d1": "0x00000000000000000000000000000000000000e1"
`;

describe("compileMandate", () => {
  it("is reproducible: same input -> same hash", () => {
    expect(compileMandate(YAML).hash).toBe(compileMandate(YAML).hash);
  });

  it("key order in YAML does not change the hash", () => {
    const reordered = `
version: 1
quote: "0x00000000000000000000000000000000000000c0"
name: Fund One
vault: "0x00000000000000000000000000000000000000b0"
universe:
  - "0x00000000000000000000000000000000000000d0"
  - "0x00000000000000000000000000000000000000d1"
priceFeeds:
  "0x00000000000000000000000000000000000000d1": "0x00000000000000000000000000000000000000e1"
  "0x00000000000000000000000000000000000000d0": "0x00000000000000000000000000000000000000e0"
covenants:
  minCashBps: 1000
  maxPositionBps: 3000
  maxDailyNotional: "1000000000000"
  maxTradeNotional: "250000000000"
`;
    expect(compileMandate(reordered).hash).toBe(compileMandate(YAML).hash);
  });

  it("rejects unknown keys", () => {
    expect(() => compileMandate(YAML + "\nrogue: true\n")).toThrow();
  });
});
