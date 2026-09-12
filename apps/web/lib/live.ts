/**
 * The real sources behind lib/data.ts. Mirror node REST + JSON-RPC reads, and
 * nothing else — no API routes, no database, no server of our own. Everything
 * here runs in a React server component.
 *
 * Two rules this file exists to keep:
 *
 *  1. Numbers on screen are re-derived, not restated. The mandate YAML is
 *     re-compiled here rather than trusting the covenant numbers in the HCS
 *     envelope body, and the covenant LIMITS come from MandatePolicy on chain
 *     rather than from the mandate — so a mandate that was published but never
 *     amended shows up as the disagreement it is, instead of rendering a
 *     limit nothing enforces.
 *  2. A read that fails fails visibly. No function here substitutes a
 *     plausible number for one it could not fetch; it throws, and lib/data.ts
 *     turns that into a labelled "sample data" banner. A dashboard that
 *     silently degrades to fiction is worse than one that says it is offline.
 */
import {
  createPublicClient,
  http,
  parseAbi,
  getAddress,
  toEventSelector,
  type Hex,
  type Transport,
} from "viem";
import { readTopic, readContractLogs, type TopicMessage } from "@indenture/hedera/mirror";
import { compileMandate } from "@indenture/mandate";
import { readFeed, valueInQuote, bps } from "@indenture/chainlink";
// A relative import, not the "@/" alias: this module is also loaded by
// scripts/e2e-local.ts under tsx, which has no Next path aliases.
import { deployments } from "./deployments";

const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function name() view returns (string)",
]);

const mandatePolicyAbi = parseAbi([
  "function maxPositionBps() view returns (uint256)",
  "function minCashBps() view returns (uint256)",
  "function maxTradeNotional() view returns (uint256)",
  "function maxDailyNotional() view returns (uint256)",
  "function currentDay() view returns (uint64)",
  "function dailyNotional() view returns (uint256)",
  "function mandateHash() view returns (bytes32)",
  "function inBreach() view returns (bool)",
]);

const identityRegistryAbi = parseAbi([
  "function isVerified(address) view returns (bool)",
]);

/**
 * MandatePolicy.Settled — the only on-chain record of a settled notional.
 * Derived from the signature rather than pasted as a constant, so renaming the
 * event in Solidity cannot leave a stale hash here matching nothing.
 */
const SETTLED_TOPIC0 = toEventSelector(
  "event Settled(address indexed vault, uint64 seq, uint256 notional, uint256 dailyTotal)",
);

// --- what has to exist before a live read is even attempted ---------------

export type ChainConfig = {
  rpcUrl: string;
  mirrorUrl: string;
  vault: Hex;
  mandatePolicy: Hex;
  currency0: Hex;
  currency1: Hex;
  quoteIsCurrency0: boolean;
};

/**
 * Live-or-not is a question about DATA, not about an environment flag. The
 * Validator and the Manager decide the same way, from the same file, so the
 * three services can never disagree about whether the fund is deployed.
 */
export function chainConfig(doc: typeof deployments = deployments): ChainConfig | null {
  const vault = doc.contracts?.IndentureVault;
  const mandatePolicy = doc.contracts?.MandatePolicy;
  const c0 = doc.pool?.currency0 as string | undefined;
  const c1 = doc.pool?.currency1 as string | undefined;
  if (!vault || !mandatePolicy || !c0 || !c1) return null;

  return {
    rpcUrl: doc.network?.rpcUrl ?? "https://testnet.hashio.io/api",
    mirrorUrl:
      doc.network?.mirrorUrl ?? "https://testnet.mirrornode.hedera.com/api/v1",
    vault: getAddress(vault),
    mandatePolicy: getAddress(mandatePolicy),
    currency0: getAddress(c0),
    currency1: getAddress(c1),
    quoteIsCurrency0: Boolean(
      (doc.pool as Record<string, unknown>)?.quoteIsCurrency0,
    ),
  };
}

/**
 * `transport` is injected only by tests. The decimal scaling below — an 18dp
 * asset, an 8dp Chainlink answer and a 6dp quote — is where a silent bug would
 * live, and none of it should need a live chain to pin down.
 */
function client(cfg: ChainConfig, transport?: Transport) {
  return createPublicClient({
    /**
     * Bounded, and not retried.
     *
     * viem defaults to a 10s timeout and three retries, so a relay that is slow
     * or unreachable costs about thirty seconds per read — which a build spends
     * before it can render a page whose fallback was sitting in the repo the
     * whole time. One attempt, three seconds, then the seeded record.
     */
    transport: transport ?? http(cfg.rpcUrl, { timeout: 3000, retryCount: 0 }),
  });
}

// --- HCS -------------------------------------------------------------------

/** The mandate the fund is bound by, re-compiled from the published YAML. */
export async function liveMandate(topicId: string, mirrorUrl: string) {
  const messages = await readTopic(topicId, { mirrorUrl, order: "desc", limit: 25 });
  const latest = messages.find(
    (m) =>
      m.envelope?.type === "MANDATE" &&
      typeof (m.envelope.body as { yaml?: unknown }).yaml === "string",
  );
  if (!latest) throw new Error(`no MANDATE envelope on topic ${topicId}`);

  const yaml = (latest.envelope!.body as { yaml: string }).yaml;
  const compiled = compileMandate(yaml);

  return {
    yaml,
    seq: latest.sequenceNumber,
    vault: latest.envelope!.vault,
    mandateHash: compiled.hash,
    covenants: {
      maxPositionBps: Number(compiled.covenantArgs.maxPositionBps),
      minCashBps: Number(compiled.covenantArgs.minCashBps),
      maxTradeNotional: compiled.covenantArgs.maxTradeNotional.toString(),
      maxDailyNotional: compiled.covenantArgs.maxDailyNotional.toString(),
    },
    priceFeeds: compiled.mandate.priceFeeds,
    feedStaleAfterSec: compiled.feedStaleAfterSec,
  };
}

/** Every message on the journal topic, newest first. */
export async function liveJournal(
  topicId: string,
  mirrorUrl: string,
): Promise<TopicMessage[]> {
  return readTopic(topicId, { mirrorUrl, order: "desc", limit: 100 });
}

// --- valuation -------------------------------------------------------------

export type Valuation = {
  navQuote: bigint;
  cashQuote: bigint;
  positionQuote: bigint;
  quoteDecimals: number;
};

/**
 * The fund priced by the feeds its own mandate names — the same arithmetic the
 * Validator does before it signs, so the gauge on the page and the covenant
 * the Validator enforces cannot drift apart.
 *
 * An unusable feed throws rather than valuing the position at zero. Zero reads
 * as a total loss, which would paint a healthy fund as one in breach.
 */
export async function liveValuation(
  cfg: ChainConfig,
  priceFeeds: Record<string, string>,
  feedStaleAfterSec: number,
  transport?: Transport,
): Promise<Valuation> {
  const pub = client(cfg, transport);
  const quote = cfg.quoteIsCurrency0 ? cfg.currency0 : cfg.currency1;
  const asset = cfg.quoteIsCurrency0 ? cfg.currency1 : cfg.currency0;

  const feeds: Record<string, string> = {};
  for (const [a, f] of Object.entries(priceFeeds)) feeds[a.toLowerCase()] = f;
  const assetFeed = feeds[asset.toLowerCase()];
  if (!assetFeed) throw new Error(`the mandate lists no price feed for ${asset}`);

  const balanceOf = (token: Hex) =>
    pub.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [cfg.vault],
    });
  const decimalsOf = async (token: Hex) =>
    Number(
      await pub.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }),
    );

  const [quoteDecimals, assetDecimals, cashQuote, assetBal, reading] = await Promise.all([
    decimalsOf(quote),
    decimalsOf(asset),
    balanceOf(quote),
    balanceOf(asset),
    readFeed(pub, assetFeed, { maxAgeSec: feedStaleAfterSec }),
  ]);

  if (!reading.ok) throw new Error(`price feed unusable: ${reading.reason}`);

  const positionQuote = valueInQuote(assetBal, assetDecimals, reading, quoteDecimals);
  return {
    navQuote: cashQuote + positionQuote,
    cashQuote,
    positionQuote,
    quoteDecimals,
  };
}

// --- covenants -------------------------------------------------------------

export type LiveCovenants = {
  limits: {
    maxPositionBps: bigint;
    minCashBps: bigint;
    maxTradeNotional: bigint;
    maxDailyNotional: bigint;
  };
  /** notional already settled inside the bucket the hook is measuring */
  dailyNotional: bigint;
  /**
  * Largest single settled trade inside that same bucket, or null when the
  * event log could not be read. Null is not zero: zero is a measurement.
  */
  largestTrade: bigint | null;
  mandateHash: Hex;
  inBreach: boolean;
};

/**
 * The covenant limits as the HOOK holds them, plus what has actually been
 * spent against them today.
 *
 * "Today" is the contract's own UTC day bucket (`block.timestamp / 1 days`),
 * not a trailing 24h window, because that is what `afterSwap` enforces. A
 * trailing window would draw a gauge that disagrees with the rule at every
 * midnight.
 */
export async function liveCovenants(
  cfg: ChainConfig,
  transport?: Transport,
): Promise<LiveCovenants> {
  const pub = client(cfg, transport);
  const read = (
    functionName:
      | "maxPositionBps"
      | "minCashBps"
      | "maxTradeNotional"
      | "maxDailyNotional"
      | "currentDay"
      | "dailyNotional"
      | "mandateHash"
      | "inBreach",
  ) => pub.readContract({ address: cfg.mandatePolicy, abi: mandatePolicyAbi, functionName });

  const [
    maxPositionBps,
    minCashBps,
    maxTradeNotional,
    maxDailyNotional,
    currentDay,
    dailyNotional,
    mandateHash,
    inBreach,
    block,
  ] = await Promise.all([
    read("maxPositionBps") as Promise<bigint>,
    read("minCashBps") as Promise<bigint>,
    read("maxTradeNotional") as Promise<bigint>,
    read("maxDailyNotional") as Promise<bigint>,
    read("currentDay") as Promise<bigint>,
    read("dailyNotional") as Promise<bigint>,
    read("mandateHash") as Promise<Hex>,
    read("inBreach") as Promise<boolean>,
    pub.getBlock(),
  ]);

  const today = block.timestamp / 86_400n;
  const sameDay = BigInt(currentDay) === today;

  // The per-trade cap is the one covenant whose usage lives only in the event
  // log, so it is the one figure that depends on a mirror node. That
  // dependency must not take the other three gauges down with it — and an
  // unavailable log must not render as a confident zero. A day with nothing
  // settled in it IS a measured zero; an unreadable log is null, and the page
  // drops that gauge rather than drawing a number nobody measured.
  const largestTrade = sameDay
    ? await largestSettledToday(cfg, today).catch(() => null)
    : 0n;

  return {
    limits: { maxPositionBps, minCashBps, maxTradeNotional, maxDailyNotional },
    dailyNotional: sameDay ? dailyNotional : 0n,
    largestTrade,
    mandateHash,
    inBreach,
  };
}

/**
 * The biggest `notional` MandatePolicy has settled in the current day bucket,
 * read from its own event log through the mirror node. The per-trade cap is
 * the only covenant whose usage the contract does not keep in storage, so the
 * log is the only honest source for it.
 */
async function largestSettledToday(cfg: ChainConfig, today: bigint): Promise<bigint> {
  const sinceSeconds = today * 86_400n;
  const logs = await readContractLogs(cfg.mandatePolicy, {
    mirrorUrl: cfg.mirrorUrl,
    topic0: SETTLED_TOPIC0,
    sinceTimestamp: `${sinceSeconds}.000000000`,
    order: "desc",
    limit: 100,
  });

  let largest = 0n;
  for (const log of logs) {
    // data holds the non-indexed args in order: seq (uint64), notional,
    // dailyTotal — each padded to 32 bytes.
    const body = log.data.startsWith("0x") ? log.data.slice(2) : log.data;
    if (body.length < 192) continue;
    const notional = BigInt(`0x${body.slice(64, 128)}`);
    if (notional > largest) largest = notional;
  }
  return largest;
}

// --- ERC-3643 share class --------------------------------------------------

export type LiveShareClass = {
  token: string;
  name: string;
  totalSupply: string;
  /** null when no source can count them — never a guess */
  holders: number | null;
  navPerShare: string;
  frozen: boolean;
  frozenReason: string | null;
};

export async function liveShareClass(
  cfg: ChainConfig,
  token: Hex,
  navQuote: bigint,
  quoteDecimals: number,
  inBreach: boolean,
  transport?: Transport,
): Promise<LiveShareClass> {
  const pub = client(cfg, transport);
  const [name, totalSupply, decimals] = await Promise.all([
    pub.readContract({ address: token, abi: erc20Abi, functionName: "name" }),
    pub.readContract({ address: token, abi: erc20Abi, functionName: "totalSupply" }),
    pub.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }),
  ]);

  // NAV per share, to 4dp, in integer arithmetic — the share token and the
  // quote currency need not share a decimal scale.
  const shares = totalSupply as bigint;
  const scale = 10n ** BigInt(Number(decimals));
  const navPerShare =
    shares === 0n
      ? "0"
      : formatFixed((navQuote * scale * 10_000n) / (shares * 10n ** BigInt(quoteDecimals)), 4);

  return {
    token,
    name: name as string,
    totalSupply: shares.toString(),
    // ERC-3643 exposes no holder count, and counting Transfer logs would be a
    // guess dressed as a fact. The page renders an em-dash instead.
    holders: null,
    navPerShare,
    frozen: inBreach,
    frozenReason: inBreach
      ? "MandatePolicy.inBreach() is true — a covenant breach was observed on chain"
      : null,
  };
}

/** Render an integer scaled by 10^places as a decimal string. */
function formatFixed(scaled: bigint, places: number): string {
  const divisor = 10n ** BigInt(places);
  const whole = scaled / divisor;
  const frac = (scaled % divisor).toString().padStart(places, "0");
  return `${whole}.${frac}`;
}

/**
 * Which of the fund's real signers the identity registry will let hold shares.
 * These addresses exist on chain, unlike a hand-written demo list, so the
 * verified / not-verified split on /shares is a fact rather than a mock.
 */
export async function liveIdentities(cfg: ChainConfig, registry: Hex, transport?: Transport) {
  const pub = client(cfg, transport);
  const signers = (deployments.signers ?? {}) as Record<string, string>;
  const labelled = [
    { key: "issuer", label: "Issuer" },
    { key: "manager", label: "Manager" },
    { key: "validator", label: "Validator" },
  ].filter((s) => signers[s.key]);

  return Promise.all(
    labelled.map(async (s) => {
      const address = getAddress(signers[s.key]!);
      const identityVerified = await pub.readContract({
        address: registry,
        abi: identityRegistryAbi,
        functionName: "isVerified",
        args: [address],
      });
      return {
        address,
        label: s.label,
        identityVerified: Boolean(identityVerified),
        refusalReason: identityVerified
          ? undefined
          : `ComplianceRefused: identity ${address} is not verified in the IdentityRegistry`,
      };
    }),
  );
}

/** bps of NAV, saturating at 0 when NAV is 0 — used by the gauges. */
export function weightBps(part: bigint, nav: bigint): number {
  return nav === 0n ? 0 : Number(bps(part, nav));
}
