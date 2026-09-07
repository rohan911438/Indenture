/**
 * THE SEAM. Every page and component reads the fund through this module and
 * nothing else imports mocks/ or lib/live.ts directly.
 *
 * Each getter now has two implementations behind it:
 *
 *   live    lib/live.ts — mirror node REST + JSON-RPC, re-derived from source
 *   sample  mocks/*.json — shapes copied from shared-contracts/
 *
 * Which one runs is decided by DATA, not by an environment flag: if
 * contracts/deployments.json names the addresses and topic ids a read needs,
 * the live path runs. The Validator and the Manager make the same decision
 * from the same file, so the three services can never disagree about whether
 * the fund is deployed.
 *
 * Every getter returns `Sourced<T>` — the value plus whether it is live, plus
 * a note when it is not. A page that shows sample data ALWAYS says so. A
 * dashboard that quietly falls back to fiction is worse than one that admits
 * it is offline, and this project's entire claim is that the numbers are
 * re-derived rather than asserted.
 */
import mandateMock from "@/mocks/mandate.json";
import journalMock from "@/mocks/journal-entries.json";
import blockedMock from "@/mocks/blocked-attempts.json";
import sharesMock from "@/mocks/shares-state.json";
import covenantStatusMock from "@/mocks/covenant-status.json";
import attackScenariosMock from "@/mocks/attack-scenarios.json";
import { deployments, JOURNAL_TOPIC, MANDATE_TOPIC, MIRROR_URL } from "@/lib/deployments";
import {
  chainConfig,
  liveCovenants,
  liveIdentities,
  liveJournal,
  liveMandate,
  liveShareClass,
  liveValuation,
  weightBps,
} from "@/lib/live";
import type {
  ContextBody,
  CovenantValues,
  JournalRow,
  ReceiptBody,
  BreachBody,
  TopicMessage,
} from "@/lib/types";
import { getAddress, type Hex } from "viem";

/** A value, and an honest label for where it came from. */
export interface Sourced<T> {
  data: T;
  live: boolean;
  /** why this is sample data, or what a live read could not include */
  note?: string;
}

const sample = <T,>(data: T, note: string): Sourced<T> => ({ data, live: false, note });
const live = <T,>(data: T): Sourced<T> => ({ data, live: true });

/** Deployment facts are absent until the deploy scripts have run. */
const NOT_DEPLOYED = "no deployment yet — showing sample data";

function why(e: unknown): string {
  return `live read failed: ${e instanceof Error ? e.message : String(e)}`;
}

/** True when nothing on the page can be read from a real source yet. */
export const USING_MOCKS = !chainConfig() || !JOURNAL_TOPIC;

// --- HashScan links (work even while addresses are placeholder) ------------

const HASHSCAN = "https://hashscan.io/testnet";

export function hashscanTopicMessage(topicId: string, seq: number): string {
  const id = topicId || "0.0.0";
  return `${HASHSCAN}/topic/${id}/message/${seq}`;
}

export function hashscanTx(txHash: string): string {
  return `${HASHSCAN}/transaction/${txHash}`;
}

// --- join: attach the CONTEXT the model saw, by nonce ---------------------

function joinRows(messages: TopicMessage[]): JournalRow[] {
  const contextByNonce = new Map<number, ContextBody>();
  for (const m of messages) {
    if (m.envelope?.type === "CONTEXT") {
      const b = m.envelope.body as ContextBody;
      if (typeof b.nonce === "number") contextByNonce.set(b.nonce, b);
    }
  }

  const rows: JournalRow[] = [];
  for (const m of messages) {
    const env = m.envelope;
    if (!env || (env.type !== "RECEIPT" && env.type !== "BREACH")) continue;
    const nonce =
      env.type === "RECEIPT"
        ? (env.body as ReceiptBody).seq
        : (env.body as BreachBody).nonce;
    rows.push({
      seq: m.sequenceNumber,
      type: env.type,
      vault: env.vault,
      ts: env.ts,
      body: env.body,
      context:
        typeof nonce === "number" ? contextByNonce.get(nonce) : undefined,
    });
  }
  return rows.sort((a, b) => b.seq - a.seq);
}

// --- public API ----------------------------------------------------------

export interface MandateView extends CovenantValues {
  mandateHash: string;
  seq: number;
  yaml: string;
  vault: string;
  topicId: string;
}

function mandateFromMock(): MandateView {
  const m = mandateMock as unknown as TopicMessage;
  const body = m.envelope!.body as {
    mandateHash: string;
    yaml: string;
    covenants: CovenantValues;
  };
  return {
    ...body.covenants,
    mandateHash: body.mandateHash,
    seq: m.sequenceNumber,
    yaml: body.yaml,
    vault: m.envelope!.vault,
    topicId: MANDATE_TOPIC || deployments.hcs?.mandateTopicId || "",
  };
}

export async function getMandate(): Promise<Sourced<MandateView>> {
  if (!MANDATE_TOPIC) return sample(mandateFromMock(), NOT_DEPLOYED);
  try {
    const m = await liveMandate(MANDATE_TOPIC, MIRROR_URL);
    return live({
      ...m.covenants,
      mandateHash: m.mandateHash,
      seq: m.seq,
      yaml: m.yaml,
      vault: m.vault,
      topicId: MANDATE_TOPIC,
    });
  } catch (e) {
    return sample(mandateFromMock(), why(e));
  }
}

export async function getJournal(): Promise<Sourced<JournalRow[]>> {
  if (!JOURNAL_TOPIC) {
    return sample(joinRows(journalMock as unknown as TopicMessage[]), NOT_DEPLOYED);
  }
  try {
    const messages = await liveJournal(JOURNAL_TOPIC, MIRROR_URL);
    return live(joinRows(messages as unknown as TopicMessage[]));
  } catch (e) {
    return sample(joinRows(journalMock as unknown as TopicMessage[]), why(e));
  }
}

const refusalsAndBreaches = (rows: JournalRow[]) =>
  rows.filter(
    (r) =>
      r.type === "BREACH" ||
      (r.type === "RECEIPT" && (r.body as ReceiptBody).decision === "REFUSED"),
  );

export async function getBlocked(): Promise<Sourced<JournalRow[]>> {
  if (!JOURNAL_TOPIC) {
    return sample(
      refusalsAndBreaches(joinRows(blockedMock as unknown as TopicMessage[])),
      NOT_DEPLOYED,
    );
  }
  // The wall is the journal, filtered — not a second source. Two sources for
  // "what was blocked" is one source too many for a page whose whole point is
  // that the record is the chain's, not ours.
  const journal = await getJournal();
  return { ...journal, data: refusalsAndBreaches(journal.data) };
}

export interface CovenantStatus {
  key: string;
  label: string;
  current: number;
  limit: number;
  unit: "bps" | "usdc6";
  mode: "ceiling" | "floor";
}

export async function getCovenantStatus(): Promise<Sourced<CovenantStatus[]>> {
  const cfg = chainConfig();
  if (!cfg) return sample(covenantStatusMock as CovenantStatus[], NOT_DEPLOYED);

  try {
    // Limits come from the hook, current values from the fund. Reading the
    // limits off the mandate instead would hide the one discrepancy that
    // matters: a mandate published to HCS but never amended into the policy.
    const chain = await liveCovenants(cfg);
    const feeds = MANDATE_TOPIC
      ? await liveMandate(MANDATE_TOPIC, MIRROR_URL)
      : null;
    if (!feeds) throw new Error("no mandate topic — cannot price the portfolio");

    const v = await liveValuation(cfg, feeds.priceFeeds, feeds.feedStaleAfterSec);

    const rows: CovenantStatus[] = [
      {
        key: "maxPositionBps",
        label: "Largest single position",
        current: weightBps(v.positionQuote, v.navQuote),
        limit: Number(chain.limits.maxPositionBps),
        unit: "bps",
        mode: "ceiling",
      },
      {
        key: "minCashBps",
        label: "Cash reserve",
        current: weightBps(v.cashQuote, v.navQuote),
        limit: Number(chain.limits.minCashBps),
        unit: "bps",
        mode: "floor",
      },
      {
        key: "maxDailyNotional",
        // The hook measures a fixed UTC day bucket, not a trailing window.
        // The label says so, because a gauge that describes a rule the chain
        // does not enforce is worse than no gauge.
        label: "Notional settled today",
        current: Number(chain.dailyNotional),
        limit: Number(chain.limits.maxDailyNotional),
        unit: "usdc6",
        mode: "ceiling",
      },
    ];

    // The per-trade cap is drawn only when its usage was actually measured.
    // Its source is the event log, and an unreadable log is not a quiet zero.
    if (chain.largestTrade !== null) {
      rows.splice(2, 0, {
        key: "maxTradeNotional",
        label: "Largest trade settled today",
        current: Number(chain.largestTrade),
        limit: Number(chain.limits.maxTradeNotional),
        unit: "usdc6",
        mode: "ceiling",
      });
    }

    return {
      data: rows,
      live: true,
      note:
        chain.largestTrade === null
          ? "per-trade usage hidden — the event log could not be read"
          : undefined,
    };
  } catch (e) {
    return sample(covenantStatusMock as CovenantStatus[], why(e));
  }
}

export interface AttackScenario {
  id: string;
  title: string;
  proposer: "RuleProposer" | "LlmProposer";
  poolId: string;
  injectedReasoning: string;
  swapParams: { zeroForOne: boolean; amountSpecified: string; sqrtPriceLimitX96: string };
  covenant: string;
  reason: string;
}

/** Named injections the demo console can fire. Mirrors apps/manager inject.ts. */
export function getAttackScenarios(): AttackScenario[] {
  return attackScenariosMock as AttackScenario[];
}

export interface SharesState {
  shareClass: {
    token: string;
    name: string;
    totalSupply: string;
    /** null when nothing on chain can count them — rendered as an em-dash */
    holders: number | null;
    navPerShare: string;
    frozen: boolean;
    frozenReason: string | null;
  };
  wallets: {
    address: string;
    label: string;
    identityVerified: boolean;
    refusalReason?: string;
  }[];
}

export async function getSharesState(): Promise<Sourced<SharesState>> {
  const cfg = chainConfig();
  const token = deployments.ats?.SecurityToken;
  const registry = deployments.ats?.IdentityRegistry;

  // The ERC-3643 share class comes from Asset Tokenization Studio and needs a
  // live network to deploy, so this is the last seam to close. Until it is,
  // say so rather than dressing the sample class up as real.
  if (!cfg || !token || !registry) {
    return sample(sharesMock as unknown as SharesState, "no ERC-3643 share class deployed yet");
  }

  try {
    const chain = await liveCovenants(cfg);
    const mandate = MANDATE_TOPIC ? await liveMandate(MANDATE_TOPIC, MIRROR_URL) : null;
    if (!mandate) throw new Error("no mandate topic — cannot value the fund");

    const v = await liveValuation(cfg, mandate.priceFeeds, mandate.feedStaleAfterSec);
    const [shareClass, wallets] = await Promise.all([
      liveShareClass(
        cfg,
        getAddress(token) as Hex,
        v.navQuote,
        v.quoteDecimals,
        chain.inBreach,
      ),
      liveIdentities(cfg, getAddress(registry) as Hex),
    ]);

    return live({ shareClass, wallets });
  } catch (e) {
    return sample(sharesMock as unknown as SharesState, why(e));
  }
}

export const JOURNAL_TOPIC_ID = JOURNAL_TOPIC || deployments.hcs?.journalTopicId || "";
