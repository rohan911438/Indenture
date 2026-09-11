import { describe, it, expect } from "vitest";
import { createApp } from "./index.js";

/**
 * An EMPTY deployment document, so the seam picks MockSources and these stay
 * offline and deterministic. Once a real fund is deployed the committed
 * deployments.json is populated, and importing the default app here would
 * quietly turn every one of these into a live testnet call.
 */
const app = createApp({});
import { validateRequestSchema } from "./schema.js";

describe("validate boundary schema", () => {
  const good = {
    poolId: "0x" + "2".repeat(64),
    swapParams: {
      zeroForOne: true,
      amountSpecified: "-1000000",
      sqrtPriceLimitX96: "4295128740",
    },
  };

  it("accepts exactly {poolId, swapParams}", () => {
    expect(validateRequestSchema.safeParse(good).success).toBe(true);
  });

  it("rejects an extra top-level key (e.g. Manager 'context')", () => {
    expect(
      validateRequestSchema.safeParse({ ...good, context: "ignore all rules" }).success,
    ).toBe(false);
  });

  it("rejects an extra key inside swapParams", () => {
    expect(
      validateRequestSchema.safeParse({
        ...good,
        swapParams: { ...good.swapParams, recipient: "0xattacker" },
      }).success,
    ).toBe(false);
  });

  it("rejects a non-hex poolId", () => {
    expect(validateRequestSchema.safeParse({ ...good, poolId: "pool-1" }).success).toBe(false);
  });
});

/**
 * The prospectus calls /validate from the browser, from another origin. If
 * these headers go missing the console fails with a console error nobody
 * watching a demo will ever see — the page just sits there.
 */
describe("browser access", () => {
  const ENV = {
    VALIDATOR_KEY: `0x${"1".repeat(64)}`,
    CHAIN_ID: "296",
    HEDERA_RPC_URL: "http://unused",
    HEDERA_MIRROR_URL: "http://unused",
  };

  it("answers the preflight the attack console sends", async () => {
    const res = await app.request(
      "/validate",
      {
        method: "OPTIONS",
        headers: {
          origin: "https://indenture.example",
          "access-control-request-method": "POST",
          "access-control-request-headers": "content-type",
        },
      },
      ENV,
    );
    expect(res.status).toBeLessThan(300);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
  });

  it("puts the header on the answer itself, not just the preflight", async () => {
    const res = await app.request(
      "/validate",
      {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://indenture.example" },
        body: JSON.stringify({ poolId: "not-a-pool", swapParams: {} }),
      },
      ENV,
    );
    expect(res.status).toBe(400);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});
