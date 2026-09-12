import { Suspense } from "react";
import { JournalTable, type JournalTableRow } from "@/components/paper/JournalTable";
import { DemoChip } from "@/components/paper/SealGate";
import { Eyebrow, Rule } from "@/components/paper/Primitives";
import { Reveal } from "@/components/motion/Reveal";
import { getJournal, hashscanTopicMessage, JOURNAL_TOPIC_ID } from "@/lib/data";
import { fmtUtc } from "@/lib/format";
import type { BreachBody, JournalRow, ReceiptBody } from "@/lib/types";

export const revalidate = 5;

export const metadata = {
  title: "Journal — Indenture",
  description:
    "Every decision the fund has made, written to Hedera consensus before it was anyone's word.",
};

/** The covenant is the first field of the reason string, by convention. */
function shortReason(reason: string): string {
  const head = reason.includes(":") ? reason.slice(0, reason.indexOf(":")) : reason;
  return head.length > 28 ? head.slice(0, 27) + "…" : head;
}

function toRow(row: JournalRow): JournalTableRow {
  const href = hashscanTopicMessage(JOURNAL_TOPIC_ID, row.seq);
  const pool = row.context?.poolId
    ? `${row.context.poolId.slice(0, 8)}…${row.context.poolId.slice(-4)}`
    : "—";

  if (row.type === "BREACH") {
    const b = row.body as BreachBody;
    return {
      seq: row.seq,
      time: fmtUtc(row.ts).replace(" UTC", ""),
      nonce: b.nonce != null ? String(b.nonce) : "—",
      type: "BreachObserved",
      pool,
      outcome: b.covenant,
      tone: "refuse",
      href,
    };
  }

  const b = row.body as ReceiptBody;
  const approved = b.decision === "APPROVED";
  return {
    seq: row.seq,
    time: fmtUtc(row.ts).replace(" UTC", ""),
    nonce: b.seq != null ? String(b.seq) : "—",
    type: approved ? "Executed" : "Refused",
    pool,
    outcome: approved ? "covenants satisfied" : shortReason(b.reason ?? ""),
    tone: approved ? "permit" : "refuse",
    href,
  };
}

export default async function JournalPage() {
  const src = await getJournal();
  const rows = src.data.map(toRow);

  return (
    <>
      <section className="shell page-head">
        <div className="page-head__chips">
          <Eyebrow>The journal</Eyebrow>
          <Suspense fallback={null}>
            <DemoChip seeded={!src.live} />
          </Suspense>
        </div>

        <Reveal as="h1" className="t-display-l section__head" start="top 95%">
          Every decision, before it was anyone&rsquo;s word.
        </Reveal>

        <p className="t-prose" style={{ marginTop: 48, color: "var(--ink-2)" }}>
          Each row is a message on Hedera Consensus Service, ordered by
          consensus rather than by this page. Nothing here is written by the
          site, and nothing can be removed from it — including the entries the
          fund would rather not have.
        </p>

        {!src.live && src.note && (
          <p className="t-data-sm" style={{ marginTop: 24, color: "var(--ink-3)" }}>
            SOURCE · SEEDED — {src.note.toUpperCase()}
          </p>
        )}
      </section>

      <Rule />

      <section className="shell" style={{ paddingBlock: "clamp(48px, 5vw, 80px)" }}>
        {/* 25 rows. Virtualisation starts earning its complexity somewhere past
            200, and this is not that. */}
        <JournalTable rows={rows} />
      </section>
    </>
  );
}
