import { describe, it, expect } from "vitest";
import { makeEnvelope } from "./envelope.js";
import { estimateChunks, messageByteLength, HCS_CHUNK_BYTES } from "./chunk.js";

const VAULT = "0x00000000000000000000000000000000000000b0";

describe("chunk sizing", () => {
  it("a small envelope is one chunk", () => {
    const e = makeEnvelope({ type: "RECEIPT", vault: VAULT, body: { decision: "REFUSED" } });
    expect(messageByteLength(e)).toBeLessThan(HCS_CHUNK_BYTES);
    expect(estimateChunks(e)).toBe(1);
  });

  it("a body over 1024 bytes needs more than one chunk", () => {
    const e = makeEnvelope({
      type: "CONTEXT",
      vault: VAULT,
      body: { reasoning: "x".repeat(3000) },
    });
    expect(messageByteLength(e)).toBeGreaterThan(2 * HCS_CHUNK_BYTES);
    expect(estimateChunks(e)).toBeGreaterThanOrEqual(3);
  });
});
