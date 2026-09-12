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
import mandateHistoryMock from "@/mocks/mandate-history.json";
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
  MandateBody,
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

/** How long any one live read may hold a page up before the seam gives up. */
const DEADLINE_MS = 4000;

/**
 * A live read, bounded.
 *
 * The mirror node is reached with a plain fetch inside @indenture/hedera, which
 * carries no timeout, so an unreachable host hangs on DNS or connect for as
 * long as the platform allows — a build with no network sat on this for ten
 * minutes and produced nothing, with the fixture that would have rendered the
 * page sitting in the repo the entire time.
 *
 * This does not cancel the request; it stops waiting on it. That is the whole
 * requirement: every page must render from seeded data with no chain
 * connection, and a page that renders eventually does not meet it.
 */
function withDeadline<T>(work: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    work,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} did not answer within ${DEADLINE_MS}ms`)),
        DEADLINE_MS,
      ).unref?.(),
    ),
  ]);
}

/** True when nothing on the page can be read from a real source yet. */
export const USING_MOCKS = !chainConfig() || !JOURNAL_TOPIC;

// --- HashScan links (work even while addresses are placeholder) ------------

const HASHSCAN = "https://hashscan.io/testnet";

export function hashscanTopic(topicId: string): string {
  return `${HASHSCAN}/topic/${topicId || "0.0.0"}`;
}

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
    const m = await withDeadline(liveMandate(MANDATE_TOPIC, MIRROR_URL), "mandate topic");
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

/** One published version of the mandate, and what changed when it landed. */
export interface MandateAmendment {
  seq: number;
  ts: number;
  action: "ADOPTED" | "AMENDED";
  mandateHash: string;
  prevMandateHash: string | null;
  covenants: CovenantValues;
}

function amendmentsFrom(messages: TopicMessage[]): MandateAmendment[] {
  return messages
    .filter((m) => m.envelope?.type === "MANDATE")
    .map((m) => {
      const b = m.envelope!.body as MandateBody;
      return {
        seq: m.sequenceNumber,
        ts: m.envelope!.ts,
        action: b.action,
        mandateHash: b.mandateHash,
        prevMandateHash: b.prevMandateHash,
        covenants: b.covenants,
      };
    })
    .sort((a, b) => b.seq - a.seq);
}

/**
 * Every version of the mandate this fund has published, newest first.
 *
 * The mandate topic holds the whole chain, not just the current terms, so this
 * reads the same topic getMandate() reads and keeps all of it. An instrument
 * whose terms can change without a record of the change is not an instrument,
 * and the amendment list is how a reader checks that the covenants being
 * enforced today are the ones that were agreed.
 */
export async function getMandateHistory(): Promise<Sourced<MandateAmendment[]>> {
  const fallback = () =>
    amendmentsFrom(mandateHistoryMock as unknown as TopicMessage[]);

  if (!MANDATE_TOPIC) return sample(fallback(), NOT_DEPLOYED);
  try {
    const messages = await withDeadline(liveJournal(MANDATE_TOPIC, MIRROR_URL), "mandate topic");
    const rows = amendmentsFrom(messages as unknown as TopicMessage[]);
    // A topic that answers but holds no MANDATE envelope yet is a deploy that
    // has not published its terms. Saying "no amendments" there would read as
    // "never amended", which is a different and much stronger claim.
    if (rows.length === 0) return sample(fallback(), "mandate topic holds no published terms yet");
    return live(rows);
  } catch (e) {
    return sample(fallback(), why(e));
  }
}

const refusalsAndBreaches = (rows: JournalRow[]) =>
  rows.filter(
    (r) =>
      r.type === "BREACH" ||
      (r.type === "RECEIPT" && (r.body as ReceiptBody).decision === "REFUSED"),
  );

/**
 * The record, live where there is one.
 *
 * One rule decides it, here, once — so the ticker, /journal and /blocked can
 * never disagree about which record they are showing. The live topic wins when
 * it holds at least one refusal or breach; otherwise the seeded record is used
 * and every page that shows it says so.
 *
 * The threshold is a refusal rather than a row because a wall with nothing on
 * it demonstrates nothing. A freshly deployed fund whose manager has not yet
 * tried anything it should not is the honest state of the chain and a useless
 * state of the argument, and the choice between them is not one to make
 * silently: `live` is false and the note says exactly why.
 */
export async function getJournal(): Promise<Sourced<JournalRow[]>> {
  const seeded = () => joinRows(journalMock as unknown as TopicMessage[]);

  if (!JOURNAL_TOPIC) return sample(seeded(), NOT_DEPLOYED);

  try {
    const messages = await withDeadline(liveJournal(JOURNAL_TOPIC, MIRROR_URL), "journal topic");
    const rows = joinRows(messages as unknown as TopicMessage[]);
    const refusals = refusalsAndBreaches(rows);
    if (refusals.length === 0) {
      return sample(
        seeded(),
        `journal topic ${JOURNAL_TOPIC} is live and holds ${rows.length} decision${rows.length === 1 ? "" : "s"}, none of them a refusal yet`,
      );
    }
    return live(rows);
  } catch (e) {
    return sample(seeded(), why(e));
  }
}

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
    const chain = await withDeadline(liveCovenants(cfg), "the JSON-RPC relay");
    const feeds = MANDATE_TOPIC
      ? await withDeadline(liveMandate(MANDATE_TOPIC, MIRROR_URL), "mandate topic")
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

/**
 * Named injections the demo console can fire. Mirrors apps/manager inject.ts.
 *
 * The pool is re-pointed at the deployed one when there is a deployment. The
 * fixtures carry a placeholder pool id, and firing at a pool the fund does not
 * hold proves nothing: the Validator prices the trade against THAT pool's
 * currencies, so a placeholder can come back APPROVED and make the console look
 * like it disproved its own page. The manager's real injections read the pool
 * from fund state for the same reason.
 */
export function getAttackScenarios(): AttackScenario[] {
  const pool = deployments.pool?.poolId;
  const scenarios = attackScenariosMock as AttackScenario[];
  if (!pool) return scenarios;
  return scenarios.map((s) => ({ ...s, poolId: pool }));
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
    const chain = await withDeadline(liveCovenants(cfg), "the JSON-RPC relay");
    const mandate = MANDATE_TOPIC ? await withDeadline(liveMandate(MANDATE_TOPIC, MIRROR_URL), "mandate topic") : null;
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
