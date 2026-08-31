import type { JournalRow, ReceiptBody, BreachBody } from "@/lib/types";
import { hashscanTopicMessage } from "@/lib/data";

function fmtTs(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return (
    d.toISOString().replace("T", " ").replace(/\.\d+Z$/, "") + " UTC"
  );
}

function tag(row: JournalRow): { label: string; className: string } {
  if (row.type === "BREACH")
    return { label: "breach", className: "text-oxblood border-oxblood" };
  const decision = (row.body as ReceiptBody).decision;
  return decision === "APPROVED"
    ? { label: "approved", className: "text-brass border-brass" }
    : { label: "refused", className: "text-oxblood border-oxblood" };
}

function detailLine(row: JournalRow): string {
  if (row.type === "BREACH") {
    const b = row.body as BreachBody;
    return `${b.covenant} · tx ${b.observedTxHash.slice(0, 10)}…`;
  }
  const b = row.body as ReceiptBody;
  if (b.decision === "APPROVED" && b.signature) {
    return `sig ${b.signature.slice(0, 14)}… · nonce ${b.seq ?? "—"}`;
  }
  return `paramsHash ${(b.paramsHash ?? "0x").slice(0, 14)}… · nonce ${b.seq ?? "—"}`;
}

/**
 * One journal row. Used unchanged by /blocked and /journal — do not fork.
 * A refused/breach row with an attached CONTEXT renders the callout.
 */
export function JournalEntry({
  row,
  topicId,
}: {
  row: JournalRow;
  topicId: string;
}) {
  const t = tag(row);
  const body = row.body as ReceiptBody & BreachBody;
  const reason = row.type === "BREACH" ? body.detail : body.reason;
  const showCallout =
    !!row.context && (t.label === "refused" || t.label === "breach");

  return (
    <article className="py-6">
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-xs text-slate tabular-nums">
            #{row.seq}
          </span>
          <span
            className={`font-sans text-[11px] uppercase tracking-wider border px-1.5 py-0.5 ${t.className}`}
          >
            {t.label}
          </span>
        </div>
        <time className="font-mono text-xs text-slate">{fmtTs(row.ts)}</time>
      </div>

      <p className="mt-3 font-serif text-[17px] leading-snug text-signal">
        {reason}
      </p>

      <div className="mt-2 flex items-baseline justify-between gap-4">
        <span className="font-mono text-xs text-slate break-all">
          {detailLine(row)}
        </span>
        <a
          href={hashscanTopicMessage(topicId, row.seq)}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-xs text-slate hover:text-signal whitespace-nowrap"
        >
          HashScan ↗
        </a>
      </div>

      {showCallout && row.context && (
        <div className="mt-4 border-l-2 border-oxblood pl-4">
          <div className="font-mono text-[11px] uppercase tracking-wider text-oxblood">
            context the model saw
            {row.context.injected && (
              <span className="ml-2 border border-oxblood px-1.5 py-0.5">
                injection
              </span>
            )}
          </div>
          <p className="mt-2 font-serif italic text-[15px] leading-relaxed text-slate">
            “{row.context.reasoning}”
          </p>
          <div className="mt-1 font-mono text-[11px] text-slate">
            {row.context.proposer} · dropped at the boundary, never sent to the
            Validator
          </div>
        </div>
      )}
    </article>
  );
}
