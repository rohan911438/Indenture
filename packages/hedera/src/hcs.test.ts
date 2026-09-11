import { describe, it, expect } from "vitest";
import { parseOperatorKey } from "./hcs.js";

/**
 * The Hedera portal shows the same account's key in two encodings, and the
 * rest of this repo can only use one of them. Foundry and viem need the raw
 * hex; the SDK historically only got the DER. Whichever the operator pasted
 * into .env, something downstream broke. These are the two shapes that must
 * both work from one value.
 */
describe("operator key encodings", () => {
  // A real testnet key pair from the portal, in both encodings. Throwaway,
  // never funded, and here only so the two branches are actually exercised.
  const HEX = "0x459f51b99f5c7f5c84445aa7d9e548b4a6d0cdda765baba870c261cfc94eac85";
  const DER =
    "3030020100300706052b8104000a04220420459f51b99f5c7f5c84445aa7d9e548b4a6d0cdda765baba870c261cfc94eac85";

  it("reads the HEX form the EVM tooling also needs", () => {
    expect(parseOperatorKey(HEX)).toBeTruthy();
  });

  it("reads the same key without the 0x prefix", () => {
    expect(parseOperatorKey(HEX.slice(2)).toStringRaw()).toBe(
      parseOperatorKey(HEX).toStringRaw(),
    );
  });

  it("still reads the DER form", () => {
    expect(parseOperatorKey(DER)).toBeTruthy();
  });

  it("resolves both encodings of one account to the same key", () => {
    // The actual claim. If these ever diverge, the journaler would be signing
    // as a different account than the deployer, and the topics it writes to
    // would be owned by nobody the fund can prove it controls.
    expect(parseOperatorKey(HEX).toStringRaw()).toBe(parseOperatorKey(DER).toStringRaw());
  });

  it("tolerates surrounding whitespace from a copy-paste", () => {
    expect(parseOperatorKey(`  ${HEX}\n`).toStringRaw()).toBe(
      parseOperatorKey(HEX).toStringRaw(),
    );
  });

  it("throws on something that is neither", () => {
    expect(() => parseOperatorKey("not-a-key")).toThrow();
  });
});
