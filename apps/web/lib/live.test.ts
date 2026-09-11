import { describe, it, expect, afterEach } from "vitest";
import {
  custom,
  encodeAbiParameters,
  numberToHex,
  parseAbiParameters,
  toFunctionSelector,
  type Hex,
} from "viem";
import {
  chainConfig,
  liveCovenants,
  liveShareClass,
  liveValuation,
  weightBps,
  type ChainConfig,
} from "./live";

/**
 * The page is a claim about the fund. Every number on it is scaled at least
 * twice on the way to the screen — an 18dp asset, an 8dp Chainlink answer, a
 * 6dp quote, and a share token with a decimal count of its own — and getting
 * one of those wrong does not throw. It renders a plausible number and a
 * wrong gauge, which is the failure this project exists to argue against.
 *
 * So the arithmetic is pinned here, offline, with no chain and no mirror node.
 */

const QUOTE = "0x00000000000000000000000000000000000000c0"; // 6dp, currency0
const ASSET = "0x00000000000000000000000000000000000000d0"; // 18dp, currency1
const FEED = "0x00000000000000000000000000000000000000e0"; //  8dp
const VAULT = "0x00000000000000000000000000000000000000b0";
const POLICY = "0x00000000000000000000000000000000000000a4";
const TOKEN = "0x00000000000000000000000000000000000000f0"; // 18dp share class

const SELECTORS = {
  balanceOf: toFunctionSelector("function balanceOf(address) view returns (uint256)"),
  decimals: toFunctionSelector("function decimals() view returns (uint8)"),
  totalSupply: toFunctionSelector("function totalSupply() view returns (uint256)"),
  name: toFunctionSelector("function name() view returns (string)"),
  latestRoundData: toFunctionSelector(
    "function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)",
  ),
  maxPositionBps: toFunctionSelector("function maxPositionBps() view returns (uint256)"),
  minCashBps: toFunctionSelector("function minCashBps() view returns (uint256)"),
  maxTradeNotional: toFunctionSelector(
    "function maxTradeNotional() view returns (uint256)",
  ),
  maxDailyNotional: toFunctionSelector(
    "function maxDailyNotional() view returns (uint256)",
  ),
  currentDay: toFunctionSelector("function currentDay() view returns (uint64)"),
  dailyNotional: toFunctionSelector("function dailyNotional() view returns (uint256)"),
  mandateHash: toFunctionSelector("function mandateHash() view returns (bytes32)"),
  inBreach: toFunctionSelector("function inBreach() view returns (bool)"),
};

type ChainState = {
  quoteBalance: bigint;
  assetBalance: bigint;
  /** quote units per whole asset token, 8dp — 100_00000000n is $100 */
  price: bigint;
  updatedAt: number;
  totalSupply: bigint;
  dailyNotional: bigint;
  /** absent means the stored bucket is today's */
  bucketDay?: bigint;
  blockTime?: number;
  inBreach?: boolean;
};

const now = () => Math.floor(Date.now() / 1000);

/** NAV 1,000,000 USDC: 400,000 cash + 6,000 asset @ $100. */
function baseState(): ChainState {
  return {
    quoteBalance: 400_000_000_000n,
    assetBalance: 6_000n * 10n ** 18n,
    price: 100n * 10n ** 8n,
    updatedAt: now() - 30,
    totalSupply: 800_000n * 10n ** 18n,
    dailyNotional: 0n,
  };
}

function fakeChain(state: ChainState) {
  const blockTime = BigInt(state.blockTime ?? now());

  return custom({
    async request({ method, params }: { method: string; params?: unknown[] }) {
      if (method === "eth_getBlockByNumber") {
        return { number: "0x1", hash: `0x${"1".repeat(64)}`, timestamp: numberToHex(blockTime) };
      }
      if (method !== "eth_call") throw new Error(`unexpected RPC method ${method}`);
      const { to, data } = (params as [{ to: Hex; data: Hex }])[0];
      const selector = data.slice(0, 10);
      const target = to.toLowerCase();
      const uint256 = (v: bigint) => encodeAbiParameters(parseAbiParameters("uint256"), [v]);

      switch (selector) {
        case SELECTORS.decimals: {
          const d = target === QUOTE ? 6 : target === ASSET || target === TOKEN ? 18 : 8;
          return encodeAbiParameters(parseAbiParameters("uint8"), [d]);
        }
        case SELECTORS.balanceOf:
          return uint256(target === QUOTE ? state.quoteBalance : state.assetBalance);
        case SELECTORS.totalSupply:
          return uint256(state.totalSupply);
        case SELECTORS.name:
          return encodeAbiParameters(parseAbiParameters("string"), ["Fund One Class A"]);
        case SELECTORS.latestRoundData:
          return encodeAbiParameters(
            parseAbiParameters("uint80,int256,uint256,uint256,uint80"),
            [1n, state.price, BigInt(state.updatedAt), BigInt(state.updatedAt), 1n],
          );
        case SELECTORS.maxPositionBps:
          return uint256(3000n);
        case SELECTORS.minCashBps:
          return uint256(1000n);
        case SELECTORS.maxTradeNotional:
          return uint256(250_000_000_000n);
        case SELECTORS.maxDailyNotional:
          return uint256(1_000_000_000_000n);
        case SELECTORS.currentDay:
          return encodeAbiParameters(parseAbiParameters("uint64"), [
            state.bucketDay ?? blockTime / 86_400n,
          ]);
        case SELECTORS.dailyNotional:
          return uint256(state.dailyNotional);
        case SELECTORS.mandateHash:
          return `0x${"ab".repeat(32)}`;
        case SELECTORS.inBreach:
          return encodeAbiParameters(parseAbiParameters("bool"), [
            state.inBreach ?? false,
          ]);
        default:
          throw new Error(`unexpected call ${selector} to ${to}`);
      }
    },
  });
}

const CFG: ChainConfig = {
  rpcUrl: "http://unused",
  mirrorUrl: "http://mirror.test/api/v1",
  vault: VAULT,
  mandatePolicy: POLICY,
  currency0: QUOTE,
  currency1: ASSET,
  quoteIsCurrency0: true,
};

const FEEDS = { [ASSET]: FEED };

/** One 32-byte word, left-padded — how the EVM lays out event data. */
const word = (v: bigint) => v.toString(16).padStart(64, "0");

/** Stub the mirror node's contract-logs endpoint with Settled events. */
function stubSettledLogs(notionals: bigint[]) {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        logs: notionals.map((n, i) => ({
          address: POLICY,
          topics: [],
          data: `0x${word(BigInt(i + 1))}${word(n)}${word(n)}`,
          block_number: i + 1,
          transaction_hash: `0x${"9".repeat(64)}`,
          index: 0,
          timestamp: "1756594800.000000000",
        })),
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    )) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

let restore: (() => void) | null = null;
afterEach(() => {
  restore?.();
  restore = null;
});

describe("chainConfig", () => {
  it("stays on sample data while the addresses are empty", () => {
    // Nothing should try a live read against a fund that does not exist, and
    // no env flag should be able to force one. Asserted against an explicit
    // empty document rather than the committed file, because the committed
    // file is populated the moment a real fund is deployed — at which point
    // this test was asserting the deploy had not happened.
    const empty = {
      contracts: { IndentureVault: "", MandatePolicy: "" },
      pool: { currency0: "", currency1: "" },
      network: {},
    };
    expect(chainConfig(empty as never)).toBeNull();
  });

  it("goes live once the vault, policy and both currencies are present", () => {
    const doc = {
      contracts: {
        IndentureVault: `0x${"1".repeat(40)}`,
        MandatePolicy: `0x${"2".repeat(40)}`,
      },
      pool: { currency0: `0x${"3".repeat(40)}`, currency1: `0x${"4".repeat(40)}`, quoteIsCurrency0: false },
      network: { rpcUrl: "https://rpc.test", mirrorUrl: "https://mirror.test" },
    };
    const cfg = chainConfig(doc as never);
    expect(cfg?.rpcUrl).toBe("https://rpc.test");
    expect(cfg?.quoteIsCurrency0).toBe(false);
  });

  it("still refuses when the pool half is missing", () => {
    // A half-written deployments.json is the dangerous case: addresses that
    // look real, a pool that was never initialised.
    const doc = {
      contracts: { IndentureVault: `0x${"1".repeat(40)}`, MandatePolicy: `0x${"2".repeat(40)}` },
      pool: { currency0: "", currency1: "" },
      network: {},
    };
    expect(chainConfig(doc as never)).toBeNull();
  });
});

describe("liveValuation", () => {
  it("values an 18dp asset priced by an 8dp feed into 6dp quote units", async () => {
    const v = await liveValuation(CFG, FEEDS, 90_000, fakeChain(baseState()));
    expect(v.navQuote).toBe(1_000_000_000_000n); // 400k cash + 6,000 * $100
    expect(v.cashQuote).toBe(400_000_000_000n);
    expect(v.positionQuote).toBe(600_000_000_000n);
    expect(v.quoteDecimals).toBe(6);
  });

  it("refuses to value the fund when the feed is unusable", async () => {
    // Valuing an unreadable position at zero would read as a total loss and
    // paint a healthy fund as one in breach. Throwing surfaces it as an
    // offline banner instead.
    await expect(
      liveValuation(CFG, FEEDS, 90_000, fakeChain({ ...baseState(), price: 0n })),
    ).rejects.toThrow(/price feed unusable/);
  });

  it("refuses to value the fund when the mandate names no feed for the asset", async () => {
    await expect(liveValuation(CFG, {}, 90_000, fakeChain(baseState()))).rejects.toThrow(
      /no price feed/,
    );
  });

  it("turns valuations into the bps the gauges draw", async () => {
    const v = await liveValuation(CFG, FEEDS, 90_000, fakeChain(baseState()));
    expect(weightBps(v.positionQuote, v.navQuote)).toBe(6000);
    expect(weightBps(v.cashQuote, v.navQuote)).toBe(4000);
    // An empty fund has no weights, and must not divide by zero.
    expect(weightBps(0n, 0n)).toBe(0);
  });
});

describe("liveCovenants", () => {
  it("takes the limits from the hook, not from the mandate", async () => {
    restore = stubSettledLogs([]);
    const c = await liveCovenants(CFG, fakeChain(baseState()));
    expect(c.limits.maxPositionBps).toBe(3000n);
    expect(c.limits.maxTradeNotional).toBe(250_000_000_000n);
    expect(c.inBreach).toBe(false);
  });

  it("shows the day bucket the hook is actually measuring", async () => {
    restore = stubSettledLogs([]);
    const c = await liveCovenants(
      CFG,
      fakeChain({ ...baseState(), dailyNotional: 640_000_000_000n }),
    );
    expect(c.dailyNotional).toBe(640_000_000_000n);
  });

  it("reads yesterday's bucket as spent nothing, the way afterSwap does", async () => {
    const blockTime = now();
    const c = await liveCovenants(
      CFG,
      fakeChain({
        ...baseState(),
        blockTime,
        dailyNotional: 640_000_000_000n,
        bucketDay: BigInt(Math.floor(blockTime / 86_400)) - 1n,
      }),
    );
    // A stale bucket is an empty one, so no log read is even attempted.
    expect(c.dailyNotional).toBe(0n);
    expect(c.largestTrade).toBe(0n);
  });

  it("takes the largest single settled trade from the event log", async () => {
    restore = stubSettledLogs([50_000_000_000n, 210_000_000_000n, 1_000_000n]);
    const c = await liveCovenants(CFG, fakeChain(baseState()));
    expect(c.largestTrade).toBe(210_000_000_000n);
  });

  it("reports an unreadable log as unmeasured, not as zero", async () => {
    // Zero would draw a gauge saying the fund has traded nothing today. Null
    // makes lib/data.ts drop the gauge and say why.
    const original = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error("mirror node unreachable");
    }) as typeof fetch;
    restore = () => {
      globalThis.fetch = original;
    };

    const c = await liveCovenants(CFG, fakeChain(baseState()));
    expect(c.largestTrade).toBeNull();
    // ...and the covenants that do not need the log still came back.
    expect(c.limits.maxDailyNotional).toBe(1_000_000_000_000n);
  });

  it("counts a day with nothing settled as a measured zero", async () => {
    restore = stubSettledLogs([]);
    const c = await liveCovenants(CFG, fakeChain(baseState()));
    expect(c.largestTrade).toBe(0n);
  });
});

describe("liveShareClass", () => {
  it("computes NAV per share across differing decimal scales", async () => {
    // 1,000,000 USDC (6dp) over 800,000 shares (18dp) is $1.25 — a scale slip
    // in either direction moves it by six or twelve orders of magnitude.
    const s = await liveShareClass(
      CFG,
      TOKEN,
      1_000_000_000_000n,
      6,
      false,
      fakeChain(baseState()),
    );
    expect(s.navPerShare).toBe("1.2500");
    expect(s.name).toBe("Fund One Class A");
    expect(s.frozen).toBe(false);
    expect(s.frozenReason).toBeNull();
  });

  it("reports no holder count rather than inventing one", async () => {
    const s = await liveShareClass(
      CFG,
      TOKEN,
      1_000_000_000_000n,
      6,
      false,
      fakeChain(baseState()),
    );
    expect(s.holders).toBeNull();
  });

  it("freezes the class from the chain's own breach flag", async () => {
    const s = await liveShareClass(
      CFG,
      TOKEN,
      1_000_000_000_000n,
      6,
      true,
      fakeChain({ ...baseState(), inBreach: true }),
    );
    expect(s.frozen).toBe(true);
    expect(s.frozenReason).toMatch(/inBreach/);
  });

  it("does not divide by zero before the first subscription", async () => {
    const s = await liveShareClass(
      CFG,
      TOKEN,
      1_000_000_000_000n,
      6,
      false,
      fakeChain({ ...baseState(), totalSupply: 0n }),
    );
    expect(s.navPerShare).toBe("0");
  });
});
