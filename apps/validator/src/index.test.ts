import { describe, it, expect } from "vitest";
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
