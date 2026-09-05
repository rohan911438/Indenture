import type { JournalRow, ReceiptBody, BreachBody } from "@/lib/types";
import { hashscanTopicMessage } from "@/lib/data";

/**
 * The money shot: the newest blocked attempt as attempt-vs-verdict. Left is
 * what the AI tried (and the text it saw); right is what the Validator did and
 * why. Presentational — safe in a server component.
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
  const verdict = isBreach ? "BREACH" : "REFUSED";
  const covenant = isBreach
    ? body.covenant
    : (body.reason.split(":")[0] ?? "covenant");
  const reason = isBreach ? body.detail : body.reason;
  const ctx = row.context;

  return (
    <section
      className={
        "border p-6 transition-colors " +
        (fresh ? "border-brass" : "border-hairline")
      }
    >
      <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-slate">
        {fresh ? "just now" : "most recent"} · seq #{row.seq}
      </div>

      <div className="mt-4 grid gap-6 md:grid-cols-2 md:gap-0">
        {/* attempt */}
        <div className="md:pr-8">
          <h3 className="font-mono text-xs uppercase tracking-wider text-slate">
            What was attempted
          </h3>
          {ctx?.injected && (
            <span className="mt-2 inline-block border border-oxblood px-1.5 py-0.5 font-mono text-[11px] text-oxblood">
              prompt injection
            </span>
          )}
          {ctx ? (
            <p className="mt-3 font-serif italic text-[16px] leading-relaxed text-signal">
              “{ctx.reasoning}”
            </p>
          ) : (
            <p className="mt-3 font-serif italic text-[15px] text-slate">
              No reasoning was journaled for this attempt.
            </p>
          )}
          <div className="mt-3 font-mono text-[11px] text-slate break-all">
            {ctx?.proposer ?? "proposer"} · proposed{" "}
            {JSON.stringify(ctx?.swapParams ?? { poolId: body.poolId })}
          </div>
        </div>

        {/* verdict */}
        <div className="border-t border-hairline pt-6 md:border-t-0 md:border-l md:pl-8 md:pt-0">
          <h3 className="font-mono text-xs uppercase tracking-wider text-slate">
            What the Validator did
          </h3>
          <div className="mt-2 font-serif text-[32px] leading-none text-oxblood">
            {verdict}
          </div>
          <div className="mt-3 inline-block border border-oxblood px-1.5 py-0.5 font-mono text-[11px] text-oxblood">
            {covenant}
          </div>
          <p className="mt-3 font-serif text-[16px] leading-relaxed text-signal">
            {reason}
          </p>
          <p className="mt-2 font-mono text-[11px] text-slate">
            re-derived from source — mandate, pool state, price feed — not taken
            from the proposer
          </p>
          <a
            href={hashscanTopicMessage(topicId, row.seq)}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block font-mono text-[11px] text-brass hover:underline"
          >
            permanent record on HashScan ↗
          </a>
        </div>
      </div>
    </section>
  );
}
