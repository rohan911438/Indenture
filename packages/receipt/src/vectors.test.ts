import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { digest, signReceipt } from "./sign.js";
import type { Receipt } from "./types.js";

/**
 * Guards the committed cross-language vector. If this fails, the TS signer
 * drifted from packages/receipt/vectors/receipt-296.json — regenerate it
 * (`npm run vector`) AND re-sync contracts/test/Receipt.t.sol in the same commit.
 */
const vectorPath = fileURLToPath(
  new URL("../vectors/receipt-296.json", import.meta.url),
);
const v = JSON.parse(readFileSync(vectorPath, "utf8")) as {
  domain: { chainId: number; verifyingContract: `0x${string}` };
  receipt: {
    mandateHash: `0x${string}`;
    poolId: `0x${string}`;
    paramsHash: `0x${string}`;
    seq: string;
    deadline: string;
    vault: `0x${string}`;
  };
  digest: `0x${string}`;
  signature: `0x${string}`;
  expectedSigner: `0x${string}`;
};

const PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // anvil #0

const receipt: Receipt = {
  mandateHash: v.receipt.mandateHash,
  poolId: v.receipt.poolId,
  paramsHash: v.receipt.paramsHash,
  seq: BigInt(v.receipt.seq),
  deadline: BigInt(v.receipt.deadline),
  vault: v.receipt.vault,
};

describe("committed vector receipt-296.json", () => {
  it("digest still matches", () => {
    expect(
      digest({
        receipt,
        chainId: v.domain.chainId,
        verifyingContract: v.domain.verifyingContract,
      }),
    ).toBe(v.digest);
  });

  it("signature + signer still match", async () => {
    const s = await signReceipt({
      receipt,
      chainId: v.domain.chainId,
      verifyingContract: v.domain.verifyingContract,
      privateKey: PRIVATE_KEY,
    });
    expect(s.signature).toBe(v.signature);
    expect(s.signer).toBe(v.expectedSigner);
  });
});
