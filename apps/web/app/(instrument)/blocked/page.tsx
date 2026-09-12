import { BlockedWall } from "@/components/BlockedWall";
import { SplitLines } from "@/components/motion/SplitLines";
import { Shell } from "@/components/ui/Shell";
import { SourceNote } from "@/components/ui/SourceNote";
import { getAttackScenarios, getBlocked, JOURNAL_TOPIC_ID } from "@/lib/data";
import { VALIDATOR_URL } from "@/lib/deployments";

export const revalidate = 5;

/**
 * The wall. A console to fire a prompt injection at the pipeline, the newest
 * blocked attempt shown as attempt against verdict, then everything earlier.
 * A blocked attack is the product, not a hidden failure.
 */
export default async function BlockedPage() {
  const [blocked, scenarios] = await Promise.all([
    getBlocked(),
    Promise.resolve(getAttackScenarios()),
  ]);
  const rows = blocked.data;

  return (
    <Shell className="py-16 lg:py-24">
      <div className="grid grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <SplitLines as="h1" className="heading max-w-[20ch] text-signal">
            Trades the Validator refused to sign, and covenant breaches caught
            on-chain.
          </SplitLines>
          <p className="prose-measure mt-7 text-slate-lit">
            Every entry is a permanent record on the Hedera Consensus Service.
            The reason is re-derived from source — the mandate, the pool state,
            the price feed — and never taken from the proposer that asked.
          </p>
        </div>

        <div className="lg:col-span-5 lg:pt-3">
          <SourceNote
            live={blocked.live}
            note={blocked.note}
            subject="These records"
          />
          <p className="prose-measure mt-5 font-sans text-data text-slate-lit">
            {VALIDATOR_URL
              ? "The console below sends to a deployed Validator and shows you what it answered."
              : "No Validator is deployed, so the console rehearses the sequence instead of asking one."}
          </p>
        </div>
      </div>

      <div className="mt-16">
        <BlockedWall
          initialRows={rows}
          scenarios={scenarios}
          topicId={JOURNAL_TOPIC_ID}
          validatorUrl={VALIDATOR_URL}
        />
      </div>
    </Shell>
  );
}
