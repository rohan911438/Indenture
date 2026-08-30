import type { ValidateRequest } from "./schema.js";

/**
 * Every fact the Validator needs, re-derived from source inside the Worker:
 *   - the compiled mandate       (from the mandate HCS topic via mirror node)
 *   - current pool + vault state (from RPC / mirror node)
 *   - reference prices           (from the Chainlink AggregatorV3 feeds)
 * None of it is taken from the request body.
 */

export type CheckContext = {
  chainId: number;
  rpcUrl: string;
  mirrorUrl: string;
};

export type CheckResult =
  | { ok: true; covenantSnapshot: Record<string, string> }
  | { ok: false; covenant: string; reason: string };

/** STUB - build step 7 (covenants second). */
export async function runCovenantChecks(
  _req: ValidateRequest,
  _ctx: CheckContext,
): Promise<CheckResult> {
  // 1. staleness: if any price feed is older than the mandate's tolerance,
  //    return { ok:false } - the Validator simply refuses. The hook never
  //    sees a staleness judgement.
  // 2. maxPositionBps  - post-trade weight of the bought asset
  // 3. minCashBps      - post-trade stablecoin reserve
  // 4. maxTradeNotional - |amountSpecified| priced in quote units
  // 5. maxDailyNotional - rolling 24h sum from the journal topic
  return {
    ok: true,
    covenantSnapshot: {
      note: "STUB: no checks wired yet",
    },
  };
}
