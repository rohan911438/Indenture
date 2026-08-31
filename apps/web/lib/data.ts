/**
 * THE SEAM. Every page/component reads the fund through this module and
 * nothing else imports mocks/ directly. Today it returns data from
 * mocks/*.json (shapes copied from shared-contracts/); when the backend
 * deploys, only this file changes — swap the JSON reads for Mirror Node REST
 * + wagmi/viem contract reads. If a component has to change too, the mock
 * shape was wrong: fix mocks/ retroactively.
 */
import mandateMock from "@/mocks/mandate.json";
import journalMock from "@/mocks/journal-entries.json";
import blockedMock from "@/mocks/blocked-attempts.json";
import sharesMock from "@/mocks/shares-state.json";
import { deployments, JOURNAL_TOPIC, MANDATE_TOPIC } from "@/lib/deployments";
import type {
  ContextBody,
  CovenantValues,
  JournalRow,
  ReceiptBody,
  BreachBody,
  TopicMessage,
} from "@/lib/types";

/** Flip to real sources by setting NEXT_PUBLIC_USE_MOCKS=false once the
 *  Mirror Node has data. The real branch is intentionally not wired yet. */
export const USING_MOCKS =
  process.env.NEXT_PUBLIC_USE_MOCKS !== "false" || !JOURNAL_TOPIC;

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

export async function getMandate(): Promise<MandateView> {
  // TODO(real): readTopic(MANDATE_TOPIC, { order: "desc", limit: 1 })[0]
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

export async function getJournal(): Promise<JournalRow[]> {
  // TODO(real): readTopic(JOURNAL_TOPIC, { order: "desc", limit: 100 })
  return joinRows(journalMock as unknown as TopicMessage[]);
}

export async function getBlocked(): Promise<JournalRow[]> {
  // TODO(real): getJournal(), then filter REFUSED + BREACH
  return joinRows(blockedMock as unknown as TopicMessage[]).filter(
    (r) =>
      r.type === "BREACH" ||
      (r.type === "RECEIPT" && (r.body as ReceiptBody).decision === "REFUSED"),
  );
}

export type SharesState = typeof sharesMock;

export async function getSharesState(): Promise<SharesState> {
  // TODO(real): SecurityToken.totalSupply(), MandatePolicy.inBreach(),
  //             IdentityRegistry.isVerified(connectedAddress)
  return sharesMock;
}

export const JOURNAL_TOPIC_ID = JOURNAL_TOPIC || deployments.hcs?.journalTopicId || "";
