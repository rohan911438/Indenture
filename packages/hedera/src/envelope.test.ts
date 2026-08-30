import { describe, it, expect } from "vitest";
import { makeEnvelope, envelopeSchema } from "./envelope.js";

const VAULT = "0x00000000000000000000000000000000000000b0";

describe("envelope", () => {
  it("stamps v + ts and validates", () => {
    const e = makeEnvelope({ type: "RECEIPT", vault: VAULT, body: { decision: "REFUSED" } });
    expect(e.v).toBe(1);
    expect(e.ts).toBeGreaterThan(0);
    expect(() => envelopeSchema.parse(e)).not.toThrow();
  });

  it("rejects unknown top-level keys", () => {
    expect(() =>
      envelopeSchema.parse({
        v: 1,
        type: "BREACH",
        vault: VAULT,
        ts: 1,
        body: {},
        extra: true,
      }),
    ).toThrow();
  });

  it("rejects an unknown type", () => {
    expect(() =>
      envelopeSchema.parse({ v: 1, type: "NOPE", vault: VAULT, ts: 1, body: {} }),
    ).toThrow();
  });
});
