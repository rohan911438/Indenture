import { BlockedWall } from "@/components/BlockedWall";
import {
  getAttackScenarios,
  getBlocked,
  JOURNAL_TOPIC_ID,
  USING_MOCKS,
} from "@/lib/data";

export const revalidate = 5;

/**
 * The wall. An attack console to fire a prompt-injection at the pipeline, the
 * newest blocked attempt shown as attempt-vs-verdict, then everything earlier.
 * A blocked attack is the product, not a hidden failure.
 */
export default async function BlockedPage() {
  const [rows, scenarios] = await Promise.all([
    getBlocked(),
    Promise.resolve(getAttackScenarios()),
  ]);

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
          Every entry is a permanent record on the Hedera Consensus Service. The
          reason is re-derived from source — mandate, pool state, price feed —
          not taken from the proposer.
          {USING_MOCKS && (
            <span className="block mt-1 text-oxblood">
              Showing sample data — no journal topic is live yet.
            </span>
          )}
        </p>
      </header>

      <div className="mt-8">
        <BlockedWall
          initialRows={rows}
          scenarios={scenarios}
          topicId={JOURNAL_TOPIC_ID}
        />
      </div>
    </div>
  );
}
