/**
 * The Validator re-derives EVERY fact from source. `Sources` is that seam:
 * one interface, two implementations.
 *
 *   MockSources  - deterministic, offline, used today + in tests.
 *   MirrorSources - reads the mandate HCS topic, vault/pool state via RPC, and
 *                   the Chainlink AggregatorV3 feeds. TODO, build step 7.
 *
 * The rest of the Worker only ever touches this interface, so swapping in the
 * real implementation is a one-line change in index.ts.
 */
import { keccak256, encodeAbiParameters, type Hex } from "viem";
import { compileMandate } from "@indenture/mandate";
import type { ValidateRequest } from "./schema.js";
import type { CovenantInputs, CovenantLimits } from "./checks.js";
import { MANDATE_YAML_FIXTURE } from "./mandate-fixture.js";

export type MandateSnapshot = {
  yaml: string;
  mandateHash: Hex;
  /** mandate HCS topic sequence number this was read from */
  seq: number;
  limits: CovenantLimits;
  universe: string[];
  quote: string;
  /** price-feed staleness tolerance, seconds — a MANDATE field, not a constant */
  feedStaleAfterSec: number;
};

export type Binding = {
  vault: Hex;
  /** MandatePolicy address = EIP-712 verifyingContract */
  mandatePolicy: Hex;
  /** next expected per-vault receipt seq (anti-replay) */
  seq: bigint;
};

export interface Sources {
  mandate(): Promise<MandateSnapshot>;
  binding(): Promise<Binding>;
  covenantInputs(
    req: ValidateRequest,
    m: MandateSnapshot,
  ): Promise<CovenantInputs>;
  /** age of the oldest feed the mandate references, seconds - for /health */
  oldestFeedAgeSec(m: MandateSnapshot): Promise<number>;
}

export function paramsHashOf(req: ValidateRequest): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { name: "zeroForOne", type: "bool" },
        { name: "amountSpecified", type: "int256" },
        { name: "sqrtPriceLimitX96", type: "uint160" },
      ],
      [
        req.swapParams.zeroForOne,
        BigInt(req.swapParams.amountSpecified),
        BigInt(req.swapParams.sqrtPriceLimitX96),
      ],
    ),
  );
}

// --------------------------------------------------------------------------
// MockSources
// --------------------------------------------------------------------------

export type MockConfig = {
  /** override the oldest-feed age (seconds) to exercise the staleness refusal */
  feedAgeSec?: number;
  /** notional already executed in the trailing 24h, quote units */
  priorDailyNotionalQuote?: bigint;
  /** the vault address this Validator signs for */
  vault?: Hex;
  /** the MandatePolicy address (EIP-712 verifyingContract) */
  mandatePolicy?: Hex;
  /** next expected receipt seq */
  seq?: bigint;
};

/** A fixed, internally-consistent fund: NAV 1,000,000 USDC (6dp).
 *  cash 4000bps + d0 2500bps + d1 2000bps + 1500bps other assets. */
const NAV_QUOTE = 1_000_000_000_000n;
const CASH_QUOTE = 400_000_000_000n; // 4000 bps
const POSITION_D0 = 250_000_000_000n; // 2500 bps  <- ~500bps of headroom on a buy
const POSITION_D1 = 200_000_000_000n; // 2000 bps

export class MockSources implements Sources {
  constructor(private readonly cfg: MockConfig = {}) {}

  async mandate(): Promise<MandateSnapshot> {
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

  async binding(): Promise<Binding> {
    return {
      vault: this.cfg.vault ?? "0x00000000000000000000000000000000000000b0",
      mandatePolicy:
        this.cfg.mandatePolicy ?? "0x00000000000000000000000000000000000000a4",
      seq: this.cfg.seq ?? 0n,
    };
  }

  async oldestFeedAgeSec(): Promise<number> {
    return this.cfg.feedAgeSec ?? 12;
  }

  async covenantInputs(
    req: ValidateRequest,
    m: MandateSnapshot,
  ): Promise<CovenantInputs> {
    // Mock pool: currency0 = the mandate's risk asset, currency1 = quote.
    // Price 1:1, 6dp. amountSpecified is raw 6dp units; |x| is the notional.
    //
    // The asset is taken from the MANDATE rather than written out here. It
    // used to be the placeholder d0, which stopped being the universe the
    // moment a real deploy regenerated the mandate: every mock proposal then
    // refused with `assetNotInUniverse`, which is a true statement about a
    // fund that does not exist and tells you nothing about the one that does.
    const asset = m.universe[0] ?? "0x00000000000000000000000000000000000000d0";
    const notional =
      BigInt(req.swapParams.amountSpecified) < 0n
        ? -BigInt(req.swapParams.amountSpecified)
        : BigInt(req.swapParams.amountSpecified);

    // zeroForOne = sell asset -> quote (cash up, position down)
    // !zeroForOne = buy asset with quote (cash down, position up)
    const buyingAsset = !req.swapParams.zeroForOne;

    const postTradeCashQuote = buyingAsset
      ? CASH_QUOTE - notional
      : CASH_QUOTE + notional;
    const postTradePositionQuote = buyingAsset
      ? POSITION_D0 + notional
      : POSITION_D0 > notional
        ? POSITION_D0 - notional
        : 0n;

    return {
      limits: m.limits,
      boughtAsset: buyingAsset ? asset : m.quote,
      inUniverse: buyingAsset ? m.universe.includes(asset) : true,
      tradeNotionalQuote: notional,
      priorDailyNotionalQuote: this.cfg.priorDailyNotionalQuote ?? 0n,
      navQuote: NAV_QUOTE,
      postTradeCashQuote:
        postTradeCashQuote < 0n ? 0n : postTradeCashQuote,
      postTradePositionQuote: buyingAsset ? postTradePositionQuote : 0n,
      oldestFeedAgeSec: this.cfg.feedAgeSec ?? 12,
      feedStaleAfterSec: m.feedStaleAfterSec,
    };
  }
}

export const MOCK_NAV_QUOTE = NAV_QUOTE;
export const MOCK_CASH_QUOTE = CASH_QUOTE;
export const MOCK_POSITION_D0 = POSITION_D0;
export const MOCK_POSITION_D1 = POSITION_D1;
