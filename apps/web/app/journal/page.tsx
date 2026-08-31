import { JournalEntry } from "@/components/JournalEntry";
import { getJournal, JOURNAL_TOPIC_ID, USING_MOCKS } from "@/lib/data";
import type { ReceiptBody } from "@/lib/types";

export const revalidate = 5;

/**
 * The full append-only journal — every RECEIPT and BREACH in order, approved
 * and refused alike. Same JournalEntry component as /blocked, unfiltered.
 */
export default async function JournalPage() {
  const rows = await getJournal();

  const approved = rows.filter(
    (r) => r.type === "RECEIPT" && (r.body as ReceiptBody).decision === "APPROVED",
  ).length;
  const refused = rows.filter(
    (r) => r.type === "RECEIPT" && (r.body as ReceiptBody).decision === "REFUSED",
  ).length;
  const breaches = rows.filter((r) => r.type === "BREACH").length;

  return (
    <div>
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-slate">
          Journal
        </p>
        <h1 className="mt-4 font-serif text-[26px] leading-snug text-signal">
          Every decision the Validator made, in the order the network agreed
          it.
        </h1>
        <p className="mt-3 font-mono text-xs text-slate">
          topic {JOURNAL_TOPIC_ID || "(unset)"} · {approved} approved ·{" "}
          {refused} refused · {breaches} breach{breaches === 1 ? "" : "es"}
          {USING_MOCKS && <span className="text-oxblood"> · sample data</span>}
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="mt-12 font-serif italic text-[16px] text-slate">
          The journal is empty. Once the Manager proposes its first trade, the
          Validator&apos;s decision lands here.
        </p>
      ) : (
        <div className="mt-8 divide-y divide-hairline border-t border-hairline">
          {rows.map((row) => (
            <JournalEntry
              key={`${row.type}-${row.seq}`}
              row={row}
              topicId={JOURNAL_TOPIC_ID}
            />
          ))}
        </div>
      )}
    </div>
  );
}
