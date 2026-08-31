import type { FundState } from "./proposer.js";

/**
 * Where the Manager's view of the fund comes from. The real provider reads
 * weights / cash / prices from the mirror node using deployments.json
 * addresses; the mock mirrors the Validator's MockSources fund so the two
 * agree in local dev.
 */
export interface FundStateProvider {
  readonly name: string;
  read(): Promise<FundState>;
}

const POOL = "0x" + "2".repeat(64);
const ASSET_D0 = "0x00000000000000000000000000000000000000d0";
const ASSET_D1 = "0x00000000000000000000000000000000000000d1";

/** Deterministic. NAV 1,000,000 USDC: d0 2500bps, d1 2000bps, cash 4000bps. */
export class MockFundStateProvider implements FundStateProvider {
  readonly name = "MockFundStateProvider";
  async read(): Promise<FundState> {
    return {
      poolId: POOL,
      weights: { [ASSET_D0]: 2500, [ASSET_D1]: 2000 },
      cashBps: 4000,
      prices: { [ASSET_D0]: 100, [ASSET_D1]: 100 },
    };
  }
}

/**
 * TODO (build step 6): MirrorFundStateProvider — read the vault's token
 * balances + the pool state from the mirror node, price each with the
 * Chainlink feed the mandate lists, reduce to weights + cashBps.
 */
