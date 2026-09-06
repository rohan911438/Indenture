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
        /**
         * How old a price feed may be before the Validator refuses to sign.
         *
         * This MUST be at least the feed's heartbeat. Chainlink's Hedera feeds
         * publish on a 86400s (24h) heartbeat with a 0.5% deviation threshold,
         * so a feed that has not moved will legitimately not update for a full
         * day. A tolerance below the heartbeat refuses healthy feeds and
         * silently bricks the fund — see docs/RESEARCH.md section 2.1.
         *
         * It lives in the mandate, not in Validator code, because it is a rule
         * the fund is bound by: it belongs in the signed, hashed rulebook where
         * an auditor can see it.
         *
         * Staleness is judged OFF-CHAIN only. The hook never sees it
         * (design rule 4), so this is not a MandatePolicy covenant parameter.
         */
        feedStaleAfterSec: z.number().int().positive(),
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
