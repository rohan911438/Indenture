import type { JournalRow, ReceiptBody, BreachBody } from "@/lib/types";
import { hashscanTopicMessage } from "@/lib/data";
import { fmtUtc, isConsoleRow } from "@/lib/format";
import { ExternalLink } from "@/components/ui/ExternalLink";
import { Rule } from "@/components/ui/Rule";
import { Tag } from "@/components/ui/Tag";

/**
 * The money shot: one blocked attempt as attempt against verdict.
 *
 * Left is what the model tried and the text it was given. Right is what the
 * Validator did and why. The rule between them is the boundary, in the weight
 * that means a refusal — the same device the landing page uses, so a reader who
 * has seen one recognises the other.
 *
 * Presentational, so it stays safe in a server component.
 */
export function FeaturedBlock({
  row,
  topicId,
  fresh = false,
}: {
  row: JournalRow;
  topicId: string;
  fresh?: boolean;
}) {
  const isBreach = row.type === "BREACH";
  const body = row.body as ReceiptBody & BreachBody;
  // Read the verdict off the record. Hardcoding "Refused" here made an
  // approval render as a refusal, which is the one thing this page cannot do.
  const approved = !isBreach && body.decision === "APPROVED";
  const verdict = isBreach ? "Breached" : approved ? "Signed" : "Refused";
  const covenant = isBreach
    ? body.covenant
    : (body.reason.split(":")[0] ?? "covenant");
  const reason = isBreach ? body.detail : body.reason;
  const ctx = row.context;
  const rehearsed = body.source === "rehearsal";
  // Fired from the console: a real answer from the Validator, but nothing the
  // Manager has written to the topic, so it has no consensus sequence.
  const offJournal = isConsoleRow(body);

  return (
    <section className={`border p-6 sm:p-8 ${fresh ? "border-brass" : "border-hairline"}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <p className="font-sans text-data text-slate-lit">
          {offJournal ? (
            "Just now, from the console on this page"
          ) : (
            <>
              {fresh ? "Just now" : "Most recent"}, sequence{" "}
              <span className="data text-signal">{row.seq}</span>
            </>
          )}
        </p>
        <time className="data text-micro text-slate-lit">{fmtUtc(row.ts)}</time>
      </div>

      {rehearsed ? (
        <p className="mt-4 border-l-2 border-oxblood-edge pl-4 font-sans text-data text-oxblood-lit">
          This was a rehearsal. No Validator was reached, nothing was written to
          a topic, and the verdict below is the one we expected rather than one
          anybody gave.
        </p>
      ) : (
        offJournal && (
          <p className="mt-4 border-l-2 border-brass pl-4 font-sans text-data text-slate-lit">
            The verdict below is the deployed Validator&rsquo;s real answer. It
            has no sequence number and no HashScan record, because only the
            Manager writes to the journal topic — firing an injection from a web
            page does not, and should not, append to the chain.
          </p>
        )
      )}

      <div className="mt-8 grid gap-8 md:grid-cols-2 md:gap-0">
        {/* --- the attempt --------------------------------------------- */}
        <div className="md:pr-10">
          <h3 className="font-sans text-data text-slate-lit">
            What was attempted
          </h3>
          {ctx?.injected && (
            <div className="mt-3">
              <Tag tone="injection">prompt injection</Tag>
            </div>
          )}
          {ctx ? (
            <p className="mt-4 break-words font-serif text-[1.1875rem] italic leading-relaxed text-signal">
              &ldquo;{ctx.reasoning}&rdquo;
            </p>
          ) : (
            <p className="mt-4 font-serif text-[1.0625rem] italic text-slate-lit">
              No reasoning was journaled for this attempt, so there is nothing to
              quote. The verdict beside it still stands on its own.
            </p>
          )}
          <p className="data mt-4 break-all text-data text-slate-lit">
            {ctx?.proposer ?? "proposer"} proposed{" "}
            {JSON.stringify(ctx?.swapParams ?? { poolId: body.poolId })}
          </p>
        </div>

        {/* --- the verdict --------------------------------------------- */}
        <div
          className={`md:border-l-2 md:pl-10 ${
            approved ? "md:border-brass" : "md:border-oxblood-edge"
          }`}
        >
          <Rule weight={approved ? "covenant" : "refusal"} className="md:hidden" />
          <h3 className="mt-6 font-sans text-data text-slate-lit md:mt-0">
            What the Validator did
          </h3>
          <p
            className={`mt-3 font-serif text-[clamp(2rem,3.6vw,2.75rem)] leading-none ${
              approved ? "text-brass" : "text-oxblood-lit"
            }`}
          >
            {verdict}
          </p>
          {!approved && (
            <div className="mt-4">
              <Tag tone="refused">{covenant}</Tag>
            </div>
          )}
          <p className="mt-4 break-words font-serif text-[1.1875rem] leading-relaxed text-signal">
            {reason}
          </p>
          <p className="prose-measure mt-4 font-sans text-data text-slate-lit">
            {approved
              ? "The injected sentence made no difference in either direction — it never reached the Validator. This trade was signed because the numbers underneath it are inside every covenant."
              : "Re-derived from source — the mandate, the pool state and the price feed — never taken from the proposer."}
          </p>
          {!offJournal && (
            <p className="mt-5 font-sans text-data text-brass">
              <ExternalLink href={hashscanTopicMessage(topicId, row.seq)}>
                The permanent record on HashScan
              </ExternalLink>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
