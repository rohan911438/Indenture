import { z } from "zod";

/**
 * The mandate is authored in YAML (mandates/fund-one.yaml), compiled to a
 * canonical JSON form, and hashed. The hash is what the Validator, the
 * MandatePolicy, and the HCS journal all agree on.
 *
 * Covenants are integer-only so the on-chain check is a fixed-width compare.
 */
export const mandateSchema = z
  .object({
    version: z.literal(1),
    name: z.string().min(1),
    vault: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    quote: z.string().regex(/^0x[0-9a-fA-F]{40}$/), // the cash / reserve currency
    covenants: z
      .object({
        maxPositionBps: z.number().int().min(0).max(10_000),
        minCashBps: z.number().int().min(0).max(10_000),
        maxTradeNotional: z.string().regex(/^\d+$/), // quote units, as decimal string
        maxDailyNotional: z.string().regex(/^\d+$/),
      })
      .strict(),
    universe: z
      .array(z.string().regex(/^0x[0-9a-fA-F]{40}$/))
      .min(1)
      .describe("assets the fund is permitted to hold"),
    priceFeeds: z
      .record(z.string(), z.string().regex(/^0x[0-9a-fA-F]{40}$/))
      .describe("asset -> Chainlink AggregatorV3 feed, read by the Validator only"),
  })
  .strict();

export type Mandate = z.infer<typeof mandateSchema>;
