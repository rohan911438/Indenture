import {
  createPublicClient,
  http,
  parseAbi,
  getAddress,
  type Hex,
  type Transport,
} from "viem";
import { readFeed, valueInQuote, bps as toBps } from "@indenture/chainlink";
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
      navQuote: "1000000000000", // 1,000,000 USDC at 6dp
      maxPositionBps: 3000,
      maxTradeNotional: "250000000000",
    };
  }
}

const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

export type MirrorFundConfig = {
  rpcUrl: string;
  poolId: string;
  vault: Hex;
  /** the cash currency */
  quote: Hex;
  /** asset -> Chainlink AggregatorV3 feed, from the mandate */
  priceFeeds: Record<string, string>;
  /** the mandate's staleness tolerance, seconds */
  feedStaleAfterSec: number;
  /** covenants, passed through so a proposer can aim inside them */
  maxPositionBps?: number;
  maxTradeNotional?: string;
  /** which side of the pair the cash is on; decides the direction flag */
  quoteIsCurrency0?: boolean;
};

/**
 * The Manager's real view of the fund: vault balances priced by the feeds the
 * mandate names, reduced to weights in bps.
 *
 * This is ADVISORY. Nothing here is trusted by anything downstream — the
 * Validator re-derives all of it independently, and disagreement between the
 * two is expected and harmless. That is the whole reason the Manager is
 * allowed to be a language model: being wrong here costs nothing.
 */
export class MirrorFundStateProvider implements FundStateProvider {
  readonly name = "MirrorFundStateProvider";

  constructor(
    private readonly cfg: MirrorFundConfig,
    private readonly transport?: Transport,
  ) {}

  async read(): Promise<FundState> {
    const client = createPublicClient({
      transport: this.transport ?? http(this.cfg.rpcUrl),
    });

    const quoteDecimals = Number(
      await client.readContract({
        address: this.cfg.quote,
        abi: erc20Abi,
        functionName: "decimals",
      }),
    );
    const cash = await client.readContract({
      address: this.cfg.quote,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [this.cfg.vault],
    });

    // Same validated reader the Validator uses (@indenture/chainlink), so the
    // two never disagree about what counts as a usable price. A feed the
    // Validator would refuse must not quietly become a number the Manager
    // proposes against.
    const assets = Object.keys(this.cfg.priceFeeds);
    const valued = await Promise.all(
      assets.map(async (asset) => {
        const address = getAddress(asset);
        const [decimals, balance, reading] = await Promise.all([
          client.readContract({ address, abi: erc20Abi, functionName: "decimals" }),
          client.readContract({
            address,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [this.cfg.vault],
          }),
          readFeed(client, this.cfg.priceFeeds[asset]!, {
            maxAgeSec: this.cfg.feedStaleAfterSec,
          }),
        ]);

        // Unusable price -> weight zero. The Manager is advisory and untrusted,
        // so being wrong is cheap; pretending to know a price is not, because
        // it would produce confident proposals the Validator then refuses for
        // reasons the Manager cannot see.
        if (!reading.ok) return { asset, value: 0n, price: 0, balance };

        return {
          asset,
          value: valueInQuote(balance, Number(decimals), reading, quoteDecimals),
          price: Number(reading.answer) / 10 ** reading.decimals,
          balance,
        };
      }),
    );

    const nav = valued.reduce((acc, v) => acc + v.value, cash);
    const bps = (part: bigint) => Number(toBps(part, nav));

    return {
      poolId: this.cfg.poolId,
      weights: Object.fromEntries(valued.map((v) => [v.asset, bps(v.value)])),
      cashBps: bps(cash),
      prices: Object.fromEntries(valued.map((v) => [v.asset, v.price])),
      navQuote: nav.toString(),
      quoteIsCurrency0: this.cfg.quoteIsCurrency0,
      positions: Object.fromEntries(
        valued.map((v) => [v.asset, { balance: v.balance.toString(), valueQuote: v.value.toString() }]),
      ),
      maxPositionBps: this.cfg.maxPositionBps,
      maxTradeNotional: this.cfg.maxTradeNotional,
    };
  }
}

