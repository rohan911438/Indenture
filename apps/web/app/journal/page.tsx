import { JournalList } from "@/components/JournalList";
import { getJournal, JOURNAL_TOPIC_ID, USING_MOCKS } from "@/lib/data";

export const revalidate = 5;

/**
 * The full append-only journal — every RECEIPT and BREACH in order, approved
 * and refused alike. Filter chips over the same JournalEntry component as
 * /blocked, unfiltered by default.
 */
export default async function JournalPage() {
  const rows = await getJournal();

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
          topic {JOURNAL_TOPIC_ID || "(unset)"} · click any entry for the full
          receipt
          {USING_MOCKS && <span className="text-oxblood"> · sample data</span>}
        </p>
      </header>

      <div className="mt-8">
        {rows.length === 0 ? (
          <p className="font-serif italic text-[16px] text-slate">
            The journal is empty. Once the Manager proposes its first trade, the
            Validator&apos;s decision lands here.
          </p>
        ) : (
          <JournalList rows={rows} topicId={JOURNAL_TOPIC_ID} />
        )}
      </div>
    </div>
  );
}
