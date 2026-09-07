/**
 * The real `Sources`. Every fact the Validator decides on is re-derived here,
 * from source, over plain HTTP:
 *
 *   mandate      <- the mandate HCS topic, via the mirror node
 *   binding      <- deployments.json + MandatePolicy.seqOf() over JSON-RPC
 *   portfolio    <- the vault's ERC-20 balances over JSON-RPC
 *   prices       <- Chainlink AggregatorV3 feeds over JSON-RPC
 *
 * Nothing is taken from the Manager's request except `{poolId, swapParams}`.
 * That is the whole point of the boundary, and it is why this file exists
 * rather than the Validator trusting anything it was handed.
 *
 * Runtime: pure HTTP only. This runs on a Cloudflare Worker, so no
 * `@hashgraph/sdk` (gRPC over HTTP/2, Node-only) and no `fs`. Reading HCS over
 * the mirror node's REST API is what keeps design rule 5 satisfied.
 */
import {
  createPublicClient,
  http,
  parseAbi,
  getAddress,
  type Hex,
  type PublicClient,
  type Transport,
} from "viem";
import { compileMandate } from "@indenture/mandate";
import { readTopic } from "@indenture/hedera/mirror";
import {
  readFeed,
  valueInQuote,
  scaleDecimals,
  type FeedReading,
} from "@indenture/chainlink";
import type { ValidateRequest } from "./schema.js";
import type { CovenantInputs } from "./checks.js";
import type { Binding, MandateSnapshot, Sources } from "./sources.js";
import { MANDATE_YAML_FIXTURE } from "./mandate-fixture.js";

const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

const mandatePolicyAbi = parseAbi([
  "function seqOf(address) view returns (uint64)",
  "function currentDay() view returns (uint64)",
  "function dailyNotional() view returns (uint256)",
]);

export type MirrorConfig = {
  rpcUrl: string;
  mirrorUrl: string;
  /** contracts.IndentureVault */
  vault: Hex;
  /** contracts.MandatePolicy — the EIP-712 verifyingContract */
  mandatePolicy: Hex;
  /** hcs.mandateTopicId; when empty the embedded fixture is used */
  mandateTopicId: string;
  /** pool.currency0 / pool.currency1 / pool.quoteIsCurrency0 */
  currency0: Hex;
  currency1: Hex;
  quoteIsCurrency0: boolean;
};

/** Every field deployments.json must have filled before this can be used. */
export function mirrorConfigFrom(d: {
  network?: { rpcUrl?: string; mirrorUrl?: string };
  contracts?: Record<string, string>;
  pool?: Record<string, unknown>;
  hcs?: Record<string, string>;
}): MirrorConfig | null {
  const vault = d.contracts?.IndentureVault;
  const mandatePolicy = d.contracts?.MandatePolicy;
  const c0 = d.pool?.currency0 as string | undefined;
  const c1 = d.pool?.currency1 as string | undefined;
  if (!vault || !mandatePolicy || !c0 || !c1) return null;

  return {
    rpcUrl: d.network?.rpcUrl ?? "https://testnet.hashio.io/api",
    mirrorUrl: d.network?.mirrorUrl ?? "https://testnet.mirrornode.hedera.com/api/v1",
    vault: getAddress(vault),
    mandatePolicy: getAddress(mandatePolicy),
    mandateTopicId: d.hcs?.mandateTopicId ?? "",
    currency0: getAddress(c0),
    currency1: getAddress(c1),
    quoteIsCurrency0: Boolean(d.pool?.quoteIsCurrency0),
  };
}

export class MirrorSources implements Sources {
  private readonly client: PublicClient;

  /**
   * @param transport injected only by tests. The decimal scaling and notional
   *        arithmetic below are the parts most likely to be silently wrong, and
   *        they should not need a live chain to prove.
   */
  constructor(
    private readonly cfg: MirrorConfig,
    transport?: Transport,
  ) {
    this.client = createPublicClient({ transport: transport ?? http(cfg.rpcUrl) });
  }

  /**
   * The mandate the fund is actually bound by: the most recent MANDATE
   * envelope on the mandate topic. Read, then RE-COMPILED here rather than
   * trusting the covenant numbers in the envelope body — the hash is what the
   * chain and the journal agree on, so the Validator recomputes it from the
   * YAML and would rather fail than enforce numbers it did not derive.
   */
  async mandate(): Promise<MandateSnapshot> {
    let yaml = MANDATE_YAML_FIXTURE;
    let seq = 0;

    if (this.cfg.mandateTopicId) {
      const messages = await readTopic(this.cfg.mandateTopicId, {
        mirrorUrl: this.cfg.mirrorUrl,
        order: "desc",
        limit: 25,
      });
      const latest = messages.find(
        (m) => m.envelope?.type === "MANDATE" && typeof (m.envelope.body as { yaml?: unknown }).yaml === "string",
      );
      if (latest) {
        yaml = (latest.envelope!.body as { yaml: string }).yaml;
        seq = latest.sequenceNumber;
      }
    }

    const c = compileMandate(yaml);
    return {
      yaml,
      mandateHash: c.hash,
      seq,
      limits: c.covenantArgs,
      universe: c.mandate.universe,
      quote: c.mandate.quote,
      feedStaleAfterSec: c.feedStaleAfterSec,
    };
  }

  /**
   * The next receipt sequence comes from the chain, never from a counter here.
   * MandatePolicy.seqOf is the anti-replay boundary; asking it directly is the
   * only way the signed seq can be right.
   */
  async binding(): Promise<Binding> {
    const seq = await this.client.readContract({
      address: this.cfg.mandatePolicy,
      abi: mandatePolicyAbi,
      functionName: "seqOf",
      args: [this.cfg.vault],
    });
    return {
      vault: this.cfg.vault,
      mandatePolicy: this.cfg.mandatePolicy,
      seq: BigInt(seq),
    };
  }

  /**
   * For /health. Reports the age of the oldest feed the mandate depends on, or
   * -1 when a feed is unusable for a reason other than age — /health must never
   * imply a broken feed is merely old.
   */
  async oldestFeedAgeSec(m: MandateSnapshot): Promise<number> {
    const feeds = Object.values(feedsOf(m));
    if (feeds.length === 0) return 0;

    const readings = await Promise.all(
      feeds.map((f) => readFeed(this.client, f, { maxAgeSec: m.feedStaleAfterSec })),
    );
    if (readings.some((r) => !r.ok && r.fault !== "stale")) return -1;
    return Math.max(...readings.map((r) => (r.ok ? r.ageSec : m.feedStaleAfterSec + 1)));
  }

  async covenantInputs(req: ValidateRequest, m: MandateSnapshot): Promise<CovenantInputs> {
    const quote = this.cfg.quoteIsCurrency0 ? this.cfg.currency0 : this.cfg.currency1;
    const asset = this.cfg.quoteIsCurrency0 ? this.cfg.currency1 : this.cfg.currency0;

    // zeroForOne sells currency0 for currency1. The vault is buying the risk
    // asset exactly when the currency it spends is the quote.
    const buyingAsset = this.cfg.quoteIsCurrency0
      ? req.swapParams.zeroForOne
      : !req.swapParams.zeroForOne;

    const assetFeed = feedsOf(m)[asset.toLowerCase()];

    const [quoteDecimals, assetDecimals, quoteBal, assetBal, priorDaily, reading] =
      await Promise.all([
        this.decimalsOf(quote),
        this.decimalsOf(asset),
        this.balanceOf(quote),
        this.balanceOf(asset),
        this.priorDailyNotional(),
        assetFeed
          ? readFeed(this.client, assetFeed, { maxAgeSec: m.feedStaleAfterSec })
          : Promise.resolve<FeedReading>({
              ok: false,
              fault: "unreadable",
              reason: `the mandate lists no price feed for ${asset}`,
              detail: { asset },
            }),
      ]);

    // No usable price means no defensible valuation. Refusing is always
    // available; guessing a price is not. The specific fault travels to the
    // journal so the refusal says what actually went wrong.
    //
    // Staleness is deliberately NOT reported as a feedFault. "too old" and
    // "not a valid answer at all" are different refusals in
    // shared-contracts/validator-api.md, and routing age through feedFault
    // would make the feedStaleness reason unreachable — every stale feed
    // would be journaled as feedUnusable, which is true but less useful to
    // whoever is auditing why the fund stopped trading.
    if (!reading.ok && reading.fault === "stale") {
      return {
        limits: m.limits,
        boughtAsset: asset,
        inUniverse: false,
        tradeNotionalQuote: 0n,
        priorDailyNotionalQuote: 0n,
        navQuote: 1n,
        postTradeCashQuote: 0n,
        postTradePositionQuote: 0n,
        oldestFeedAgeSec: Number(reading.detail.observedAgeSec ?? m.feedStaleAfterSec + 1),
        feedStaleAfterSec: m.feedStaleAfterSec,
      };
    }

    if (!reading.ok) {
      return {
        limits: m.limits,
        boughtAsset: asset,
        inUniverse: false,
        tradeNotionalQuote: 0n,
        priorDailyNotionalQuote: 0n,
        navQuote: 1n,
        postTradeCashQuote: 0n,
        postTradePositionQuote: 0n,
        oldestFeedAgeSec: 0,
        feedStaleAfterSec: m.feedStaleAfterSec,
        feedFault: { fault: reading.fault, reason: reading.reason, detail: reading.detail },
      };
    }

    const assetValueQuote = valueInQuote(assetBal, assetDecimals, reading, quoteDecimals);
    const navQuote = quoteBal + assetValueQuote;

    // |amountSpecified| is denominated in whichever currency the caller
    // specified. A negative amount is exact-input (the currency being spent);
    // a positive one is exact-output (the currency being received). Either way
    // it must be priced into quote units before meeting a quote-denominated cap.
    const specified = BigInt(req.swapParams.amountSpecified);
    const magnitude = specified < 0n ? -specified : specified;
    const spending = req.swapParams.zeroForOne ? this.cfg.currency0 : this.cfg.currency1;
    const receiving = req.swapParams.zeroForOne ? this.cfg.currency1 : this.cfg.currency0;
    const specifiedCurrency = specified < 0n ? spending : receiving;

    const tradeNotionalQuote =
      specifiedCurrency.toLowerCase() === quote.toLowerCase()
        ? magnitude
        : valueInQuote(magnitude, assetDecimals, reading, quoteDecimals);

    const postTradeCashQuote = buyingAsset
      ? clampPositive(quoteBal - tradeNotionalQuote)
      : quoteBal + tradeNotionalQuote;
    const postTradePositionQuote = buyingAsset
      ? assetValueQuote + tradeNotionalQuote
      : clampPositive(assetValueQuote - tradeNotionalQuote);

    return {
      limits: m.limits,
      boughtAsset: buyingAsset ? asset : quote,
      inUniverse: buyingAsset
        ? m.universe.some((u) => u.toLowerCase() === asset.toLowerCase())
        : true,
      tradeNotionalQuote,
      priorDailyNotionalQuote: priorDaily,
      navQuote: navQuote > 0n ? navQuote : 1n,
      postTradeCashQuote,
      postTradePositionQuote,
      oldestFeedAgeSec: reading.ageSec,
      feedStaleAfterSec: m.feedStaleAfterSec,
    };
  }

  // --- chain reads -------------------------------------------------------

  /**
   * How much notional the fund has already executed inside the window the
   * chain is measuring — read from MandatePolicy's own day bucket, not
   * reconstructed from the journal.
   *
   * The obvious implementation is to sum `Executed` notionals from the journal
   * topic over the trailing 24h, and it would be wrong in a way that is hard
   * to see: `afterSwap` does not enforce a trailing window at all, it enforces
   * a fixed-width UTC day bucket (`block.timestamp / 1 days`). A trailing sum
   * and a day bucket disagree at every boundary, so the Validator would
   * approve trades the hook then reverts — burning gas and producing a
   * refusal whose reason lives nowhere the auditor is looking.
   *
   * Asking the contract what it thinks it has spent today makes the two
   * agree by construction. The day is derived from the latest block, not
   * `Date.now()`: an edge Worker's clock has no authority over which bucket
   * the next block lands in.
   */
  private async priorDailyNotional(): Promise<bigint> {
    const [block, currentDay, dailyNotional] = await Promise.all([
      this.client.getBlock(),
      this.client.readContract({
        address: this.cfg.mandatePolicy,
        abi: mandatePolicyAbi,
        functionName: "currentDay",
      }),
      this.client.readContract({
        address: this.cfg.mandatePolicy,
        abi: mandatePolicyAbi,
        functionName: "dailyNotional",
      }),
    ]);

    // A stale bucket is not a small bucket — it is an empty one. Carrying
    // yesterday's total forward would refuse today's first trade.
    const today = block.timestamp / 86_400n;
    return BigInt(currentDay) === today ? dailyNotional : 0n;
  }

  private async decimalsOf(token: Hex): Promise<number> {
    return Number(
      await this.client.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }),
    );
  }

  private async balanceOf(token: Hex): Promise<bigint> {
    return this.client.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [this.cfg.vault],
    });
  }

}

// --- helpers ---------------------------------------------------------------

/** asset -> feed, lowercased keys so address casing never causes a miss. */
function feedsOf(m: MandateSnapshot): Record<string, string> {
  const parsed = compileMandate(m.yaml).mandate.priceFeeds;
  const out: Record<string, string> = {};
  for (const [asset, feed] of Object.entries(parsed)) out[asset.toLowerCase()] = feed;
  return out;
}

function clampPositive(v: bigint): bigint {
  return v < 0n ? 0n : v;
}
