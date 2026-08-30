import { describe, it, expect } from "vitest";
import { signReceipt, recoverReceiptSigner, paramsHash } from "./sign.js";
import type { Receipt } from "./types.js";

const CHAIN_ID = 296;
const VERIFYING_CONTRACT = "0x00000000000000000000000000000000000000a4";
const PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const base: Receipt = {
  mandateHash:
    "0x1111111111111111111111111111111111111111111111111111111111111111",
  poolId: "0x2222222222222222222222222222222222222222222222222222222222222222",
  paramsHash:
    "0x3333333333333333333333333333333333333333333333333333333333333333",
  seq: 0n,
  deadline: 4102444800n,
  vault: "0x00000000000000000000000000000000000000b0",
};

describe("receipt signing", () => {
  it("round-trips: signer recovers", async () => {
    const s = await signReceipt({
      receipt: base,
      chainId: CHAIN_ID,
      verifyingContract: VERIFYING_CONTRACT,
      privateKey: PRIVATE_KEY,
    });
    const recovered = await recoverReceiptSigner({
      receipt: base,
      chainId: CHAIN_ID,
      verifyingContract: VERIFYING_CONTRACT,
      signature: s.signature,
    });
    expect(recovered.toLowerCase()).toBe(s.signer.toLowerCase());
  });

  it("a tampered field breaks recovery", async () => {
    const s = await signReceipt({
      receipt: base,
      chainId: CHAIN_ID,
      verifyingContract: VERIFYING_CONTRACT,
      privateKey: PRIVATE_KEY,
    });
    const recovered = await recoverReceiptSigner({
      receipt: { ...base, seq: 1n },
      chainId: CHAIN_ID,
      verifyingContract: VERIFYING_CONTRACT,
      signature: s.signature,
    });
    expect(recovered.toLowerCase()).not.toBe(s.signer.toLowerCase());
  });

  it("paramsHash is deterministic", () => {
    const p = {
      zeroForOne: true,
      amountSpecified: -1_000_000n,
      sqrtPriceLimitX96: 4295128740n,
    };
    expect(paramsHash(p)).toBe(paramsHash({ ...p }));
  });
});
