import { JournalList } from "@/components/JournalList";
import { SplitLines } from "@/components/motion/SplitLines";
import { ExternalLink } from "@/components/ui/ExternalLink";
import { Shell } from "@/components/ui/Shell";
import { SourceNote } from "@/components/ui/SourceNote";
import { getJournal, hashscanTopic, JOURNAL_TOPIC_ID } from "@/lib/data";

export const revalidate = 5;

/**
 * The full append-only journal — every receipt and breach in order, approved
 * and refused alike. Same JournalEntry component as /blocked, filtered rather
 * than forked.
 */
export default async function JournalPage() {
  const journal = await getJournal();
  const rows = journal.data;

  return (
    <Shell className="py-16 lg:py-24">
      <div className="grid grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <SplitLines as="h1" className="heading max-w-[20ch] text-signal">
            Every decision the Validator made, in the order the network agreed
            it.
          </SplitLines>
          <p className="prose-measure mt-7 text-slate-lit">
            Approvals and refusals are the same kind of record here, written to
            the same topic by the same code path. A system that journaled only
            its refusals would be advertising, not evidence.
          </p>
        </div>

        <div className="flex flex-col gap-5 lg:col-span-5 lg:pt-3">
          <div>
            <p className="font-sans text-micro text-slate">Topic</p>
            <p className="data mt-1 text-data text-signal">
              <ExternalLink href={hashscanTopic(JOURNAL_TOPIC_ID)}>
                {JOURNAL_TOPIC_ID || "(unset)"}
              </ExternalLink>
            </p>
          </div>
          <SourceNote
            live={journal.live}
            note={journal.note}
            subject="These records"
          />
        </div>
      </div>

      <div className="mt-16">
        {rows.length === 0 ? (
          <p className="prose-measure font-serif text-[1.25rem] italic leading-relaxed text-slate-lit">
            The journal is empty. Once the manager proposes its first trade, the
            Validator&rsquo;s decision lands here and cannot be taken back out.
          </p>
        ) : (
          <JournalList rows={rows} topicId={JOURNAL_TOPIC_ID} />
        )}
      </div>
    </Shell>
  );
}
