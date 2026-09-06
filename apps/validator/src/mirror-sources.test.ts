import { describe, it, expect } from "vitest";
import {
  custom,
  encodeAbiParameters,
  parseAbiParameters,
  toFunctionSelector,
  type Hex,
} from "viem";
import { MirrorSources, mirrorConfigFrom, type MirrorConfig } from "./mirror-sources.js";
import { MANDATE_YAML_FIXTURE } from "./mandate-fixture.js";
import { compileMandate } from "@indenture/mandate";

/**
 * The portfolio maths is where a silent bug would live: the quote is 6dp, the
 * asset is 18dp, and Chainlink answers are 8dp. Getting a scale factor wrong
 * does not throw — it produces a plausible number and the wrong decision. None
 * of that needs a live chain to pin down, so it is pinned down here.
 */

const QUOTE = "0x00000000000000000000000000000000000000c0"; // 6dp, currency0
const ASSET = "0x00000000000000000000000000000000000000d0"; // 18dp, currency1
const FEED = "0x00000000000000000000000000000000000000e0"; //  8dp
const VAULT = "0x00000000000000000000000000000000000000b0";
const POLICY = "0x00000000000000000000000000000000000000a4";

const SELECTORS = {
  balanceOf: toFunctionSelector("function balanceOf(address) view returns (uint256)"),
  decimals: toFunctionSelector("function decimals() view returns (uint8)"),
  seqOf: toFunctionSelector("function seqOf(address) view returns (uint64)"),
  latestRoundData: toFunctionSelector(
    "function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)",
  ),
};

type ChainState = {
  quoteBalance: bigint;
  assetBalance: bigint;
  /** quote units per whole asset token, at 8dp — 100_00000000n means $100 */
  price: bigint;
  updatedAt: number;
  seq: bigint;
  /** the round-completeness fields the naive read ignores */
  roundId?: bigint;
  answeredInRound?: bigint;
};

/** A transport that answers eth_call from a plain object. No network. */
function fakeChain(state: ChainState) {
  return custom({
    async request({ method, params }: { method: string; params?: unknown[] }) {
      if (method !== "eth_call") throw new Error(`unexpected RPC method ${method}`);
      const { to, data } = (params as [{ to: Hex; data: Hex }])[0];
      const selector = data.slice(0, 10);
      const target = to.toLowerCase();

      if (selector === SELECTORS.decimals) {
        const d = target === QUOTE ? 6 : target === ASSET ? 18 : 8;
        return encodeAbiParameters(parseAbiParameters("uint8"), [d]);
      }
      if (selector === SELECTORS.balanceOf) {
        const bal = target === QUOTE ? state.quoteBalance : state.assetBalance;
        return encodeAbiParameters(parseAbiParameters("uint256"), [bal]);
      }
      if (selector === SELECTORS.seqOf) {
        return encodeAbiParameters(parseAbiParameters("uint64"), [state.seq]);
      }
      if (selector === SELECTORS.latestRoundData) {
        return encodeAbiParameters(
          parseAbiParameters("uint80,int256,uint256,uint256,uint80"),
          [
            state.roundId ?? 1n,
            state.price,
            BigInt(state.updatedAt),
            BigInt(state.updatedAt),
            state.answeredInRound ?? state.roundId ?? 1n,
          ],
        );
      }
      throw new Error(`unexpected call ${selector} to ${to}`);
    },
  });
}

const CFG: MirrorConfig = {
  rpcUrl: "http://unused",
  mirrorUrl: "http://unused",
  vault: VAULT,
  mandatePolicy: POLICY,
  mandateTopicId: "", // falls back to the embedded fixture; no mirror call
  currency0: QUOTE,
  currency1: ASSET,
  quoteIsCurrency0: true,
};

const now = () => Math.floor(Date.now() / 1000);

/** NAV 1,000,000 USDC: 400,000 cash + 6,000 asset @ $100. */
function baseState(): ChainState {
  return {
    quoteBalance: 400_000_000_000n, // 400,000 USDC at 6dp
    assetBalance: 6_000n * 10n ** 18n, // 6,000 asset at 18dp
    price: 100n * 10n ** 8n, // $100 at 8dp
    updatedAt: now() - 30,
    seq: 0n,
  };
}

function sources(state: Partial<ChainState> = {}) {
  const s = { ...baseState(), ...state };
  return new MirrorSources(CFG, fakeChain(s));
}

async function snapshot() {
  const c = compileMandate(MANDATE_YAML_FIXTURE);
  return {
    yaml: MANDATE_YAML_FIXTURE,
    mandateHash: c.hash,
    seq: 1,
    limits: c.covenantArgs,
    universe: c.mandate.universe,
    quote: c.mandate.quote,
    feedStaleAfterSec: c.feedStaleAfterSec,
  };
}

const buy = (amount: string) => ({
  poolId: ("0x" + "2".repeat(64)) as Hex,
  swapParams: { zeroForOne: true, amountSpecified: amount, sqrtPriceLimitX96: "4295128740" },
});
const sell = (amount: string) => ({
  poolId: ("0x" + "2".repeat(64)) as Hex,
  swapParams: { zeroForOne: false, amountSpecified: amount, sqrtPriceLimitX96: "4295128740" },
});

describe("MirrorSources portfolio derivation", () => {
  it("values an 18dp asset priced by an 8dp feed into 6dp quote units", async () => {
    const i = await sources().covenantInputs(buy("-1000000"), await snapshot());
    // 400,000 cash + (6,000 * $100) = 1,000,000 USDC at 6dp
    expect(i.navQuote).toBe(1_000_000_000_000n);
  });

  it("reads the trade notional straight through when it is quote-denominated", async () => {
    // -50,000 USDC exact-in. The quote is currency0 and zeroForOne, so the
    // specified currency IS the quote: no conversion should happen.
    const i = await sources().covenantInputs(buy("-50000000000"), await snapshot());
    expect(i.tradeNotionalQuote).toBe(50_000_000_000n);
  });

  it("prices the notional when it is denominated in the asset", async () => {
    // exact-OUTPUT of 100 asset tokens (18dp) at $100 = 10,000 USDC.
    const i = await sources().covenantInputs(
      { ...buy("0"), swapParams: { ...buy("0").swapParams, amountSpecified: (100n * 10n ** 18n).toString() } },
      await snapshot(),
    );
    expect(i.tradeNotionalQuote).toBe(10_000_000_000n);
  });

  it("moves cash down and position up when buying the asset", async () => {
    const i = await sources().covenantInputs(buy("-50000000000"), await snapshot());
    expect(i.postTradeCashQuote).toBe(350_000_000_000n); // 400k - 50k
    expect(i.postTradePositionQuote).toBe(650_000_000_000n); // 600k + 50k
    expect(i.boughtAsset.toLowerCase()).toBe(ASSET);
  });

  it("moves cash up and position down when selling the asset", async () => {
    // Selling means spending currency1, so amountSpecified is denominated in
    // ASSET wei, not USDC. 500 tokens at $100 is the 50,000 USDC trade.
    // Reading that number as USDC — which is the easy mistake — would value
    // this trade at five millionths of a dollar and wave every cap.
    const i = await sources().covenantInputs(
      sell((-500n * 10n ** 18n).toString()),
      await snapshot(),
    );
    expect(i.tradeNotionalQuote).toBe(50_000_000_000n);
    expect(i.postTradeCashQuote).toBe(450_000_000_000n);
    expect(i.postTradePositionQuote).toBe(550_000_000_000n);
    // Selling into the quote currency is always in-universe.
    expect(i.inUniverse).toBe(true);
  });

  it("reports the real feed age so the staleness check can act on it", async () => {
    const i = await sources().covenantInputs(buy("-1000000"), await snapshot());
    expect(i.oldestFeedAgeSec).toBeGreaterThanOrEqual(29);
    expect(i.oldestFeedAgeSec).toBeLessThan(60);
    expect(i.feedStaleAfterSec).toBe(90_000); // from the mandate, not a constant
  });

  it("refuses rather than guesses when the asset has no price feed", async () => {
    // A mandate whose universe does not cover the pool's asset leaves the
    // Validator with no way to value the portfolio. It must fail closed.
    const m = await snapshot();
    const noFeed = new MirrorSources(
      { ...CFG, currency1: "0x00000000000000000000000000000000000000ff" },
      fakeChain(baseState()),
    );
    const i = await noFeed.covenantInputs(buy("-1000000"), m);
    // It refuses with the ACTUAL reason rather than pretending the feed is
    // merely old — the journal is the product, and "no feed is configured" and
    // "the feed is stale" are different events to whoever audits the refusal.
    expect(i.feedFault?.fault).toBe("unreadable");
    expect(i.feedFault?.reason).toContain("no price feed");
    expect(i.inUniverse).toBe(false);
  });

  it("refuses with the precise fault when the feed reports a zero price", async () => {
    const zeroPrice = new MirrorSources(CFG, fakeChain({ ...baseState(), price: 0n }));
    const i = await zeroPrice.covenantInputs(buy("-1000000"), await snapshot());
    expect(i.feedFault?.fault).toBe("nonPositiveAnswer");
  });

  it("reports a STALE feed as staleness, not as an unusable feed", async () => {
    // These are different refusals in shared-contracts/validator-api.md and
    // must stay that way. Routing age through feedFault would make the
    // feedStaleness reason unreachable, and every stale feed would be
    // journaled as feedUnusable — true, but less useful to whoever is
    // auditing why the fund stopped trading.
    const old = new MirrorSources(
      CFG,
      fakeChain({ ...baseState(), updatedAt: now() - 200_000 }),
    );
    const i = await old.covenantInputs(buy("-1000000"), await snapshot());
    expect(i.feedFault).toBeUndefined();
    expect(i.oldestFeedAgeSec).toBeGreaterThan(i.feedStaleAfterSec);
  });

  it("refuses when the feed answer was carried over from an earlier round", async () => {
    const carried = new MirrorSources(
      CFG,
      fakeChain({ ...baseState(), roundId: 42n, answeredInRound: 41n }),
    );
    const i = await carried.covenantInputs(buy("-1000000"), await snapshot());
    expect(i.feedFault?.fault).toBe("staleRound");
  });

  it("takes the receipt sequence from the chain, not a local counter", async () => {
    const b = await sources({ seq: 7n }).binding();
    expect(b.seq).toBe(7n);
    expect(b.mandatePolicy.toLowerCase()).toBe(POLICY);
  });
});

describe("mirrorConfigFrom", () => {
  it("returns null while deployments.json is unpopulated", () => {
    expect(
      mirrorConfigFrom({ contracts: { IndentureVault: "", MandatePolicy: "" }, pool: {} }),
    ).toBeNull();
  });

  it("builds a config once the addresses are filled", () => {
    const cfg = mirrorConfigFrom({
      network: { rpcUrl: "http://rpc", mirrorUrl: "http://mirror" },
      contracts: { IndentureVault: VAULT, MandatePolicy: POLICY },
      pool: { currency0: QUOTE, currency1: ASSET, quoteIsCurrency0: true },
      hcs: { mandateTopicId: "0.0.1234" },
    });
    expect(cfg).not.toBeNull();
    expect(cfg!.quoteIsCurrency0).toBe(true);
    expect(cfg!.mandateTopicId).toBe("0.0.1234");
  });
});
