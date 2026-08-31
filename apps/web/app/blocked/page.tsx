import { JournalEntry } from "@/components/JournalEntry";
import { getBlocked, JOURNAL_TOPIC_ID, USING_MOCKS } from "@/lib/data";

export const revalidate = 5;

/**
 * The wall. Every refusal and every on-chain breach, newest first — with the
 * covenant that stopped it and, where one was journaled, the exact text the
 * model saw. A blocked attack is the product, not a hidden failure.
 */
export default async function BlockedPage() {
  const rows = await getBlocked();

  return (
    <div>
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-slate">
          Blocked
        </p>
        <h1 className="mt-4 font-serif text-[26px] leading-snug text-signal">
          Trades the Validator refused to sign, and covenant breaches caught
          on-chain.
        </h1>
        <p className="mt-3 font-sans text-sm text-slate">
          Each entry is a permanent record on the Hedera Consensus Service. The
          reason is re-derived from source — mandate, pool state, price feed —
          not taken from the proposer.
          {USING_MOCKS && (
            <span className="block mt-1 text-oxblood">
              Showing sample data — no journal topic is live yet.
            </span>
          )}
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="mt-12 font-serif italic text-[16px] text-slate">
          Nothing has been blocked yet. Run <span className="font-mono not-italic">npm run inject</span>{" "}
          against the Validator to see the wall fill.
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
