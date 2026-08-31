import { describe, it, expect } from "vitest";
import app from "./index.js";

// anvil account #0 - matches packages/receipt fixtures
const ENV = {
  VALIDATOR_KEY:
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  CHAIN_ID: "296",
  HEDERA_RPC_URL: "https://testnet.hashio.io/api",
  HEDERA_MIRROR_URL: "https://testnet.mirrornode.hedera.com/api/v1",
};

const POOL = "0x" + "2".repeat(64);

function post(body: unknown) {
  return app.request(
    "/validate",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
    ENV,
  );
}

describe("GET /health", () => {
  it("reports the validator address + mandate seq without signing", async () => {
    const res = await app.request("/health", {}, ENV);
    expect(res.status).toBe(200);
    const j = (await res.json()) as any;
    expect(j.service).toBe("indenture-validator");
    expect(j.validator).toBe("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
    expect(j.mandateSeq).toBe(1);
    expect(j.chainId).toBe(296);
  });
});

describe("GET /mandate", () => {
  it("returns the yaml, hash and covenants", async () => {
    const res = await app.request("/mandate", {}, ENV);
    const j = (await res.json()) as any;
    expect(j.yaml).toContain("name: Fund One");
    expect(j.mandateHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(j.covenants.maxPositionBps).toBe(3000);
    expect(j.covenants.maxTradeNotional).toBe("250000000000");
  });
});

describe("POST /validate", () => {
  it("400s a malformed body (NOT a refusal decision)", async () => {
    const res = await post({ poolId: POOL, swapParams: {}, extra: 1 });
    expect(res.status).toBe(400);
  });

  it("APPROVES a compliant sell and returns a recoverable signature", async () => {
    const res = await post({
      poolId: POOL,
      swapParams: {
        zeroForOne: true,
        amountSpecified: "-500000000", // 500 USDC out of the asset
        sqrtPriceLimitX96: "4295128740",
      },
    });
    expect(res.status).toBe(200);
    const j = (await res.json()) as any;
    expect(j.decision).toBe("APPROVED");
    expect(j.signer).toBe("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
    expect(j.receipt.seq).toBe("0");
    expect(j.journal.type).toBe("RECEIPT");
    expect(j.journal.body.decision).toBe("APPROVED");
  });

  it("REFUSES (200) an oversized trade with a detail object", async () => {
    const res = await post({
      poolId: POOL,
      swapParams: {
        zeroForOne: true,
        amountSpecified: "-999999999999999",
        sqrtPriceLimitX96: "4295128740",
      },
    });
    expect(res.status).toBe(200);
    const j = (await res.json()) as any;
    expect(j.decision).toBe("REFUSED");
    expect(j.detail.covenant).toBe("maxTradeNotional");
    expect(j.journal.body.decision).toBe("REFUSED");
    expect(j.signature).toBeUndefined();
  });

  it("REFUSES a buy that would break maxPositionBps", async () => {
    const res = await post({
      poolId: POOL,
      swapParams: {
        zeroForOne: false, // buy the asset
        amountSpecified: "60000000000", // +60,000 USDC -> d0 hits 3100bps
        sqrtPriceLimitX96: "1461446703485210103287273052203988822378723970341",
      },
    });
    const j = (await res.json()) as any;
    expect(j.decision).toBe("REFUSED");
    expect(j.detail.covenant).toBe("maxPositionBps");
  });

  it("APPROVES a buy that stays under the position cap", async () => {
    const res = await post({
      poolId: POOL,
      swapParams: {
        zeroForOne: false,
        amountSpecified: "40000000000", // +40,000 USDC -> d0 hits 2900bps
        sqrtPriceLimitX96: "1461446703485210103287273052203988822378723970341",
      },
    });
    const j = (await res.json()) as any;
    expect(j.decision).toBe("APPROVED");
  });
});
