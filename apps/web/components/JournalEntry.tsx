"use client";

import { useState } from "react";
import type { JournalRow, ReceiptBody, BreachBody } from "@/lib/types";
import { hashscanTopicMessage, hashscanTx } from "@/lib/data";
import { fmtUtc, isConsoleRow } from "@/lib/format";
import { DataPair } from "@/components/ui/DataPair";
import { ExternalLink } from "@/components/ui/ExternalLink";
import { SeqRail } from "@/components/ui/SeqRail";
import { Tag, type TagTone } from "@/components/ui/Tag";
import type { RuleWeight } from "@/components/ui/Rule";

function verdict(row: JournalRow): {
  label: string;
  tone: TagTone;
  weight: RuleWeight;
} {
  if (row.type === "BREACH") {
    return { label: "breach", tone: "breach", weight: "refusal" };
  }
  const decision = (row.body as ReceiptBody).decision;
  return decision === "APPROVED"
    ? { label: "approved", tone: "approved", weight: "covenant" }
    : { label: "refused", tone: "refused", weight: "refusal" };
}

/** The one fact about this row worth reading before you open it. */
function detailLine(row: JournalRow): string {
  if (row.type === "BREACH") {
    const b = row.body as BreachBody;
    return `${b.covenant}, observed in transaction ${b.observedTxHash.slice(0, 10)}…`;
  }
  const b = row.body as ReceiptBody;
  if (b.decision === "APPROVED" && b.signature) {
    return `signature ${b.signature.slice(0, 14)}…, nonce ${b.seq ?? "—"}`;
  }
  return `params ${(b.paramsHash ?? "0x").slice(0, 14)}…, nonce ${b.seq ?? "—"}`;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 12"
      width="11"
      height="11"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
    >
      <path d="M2.5 4.5L6 8l3.5-3.5" />
    </svg>
  );
}

/**
 * One journal row. Used unchanged by /blocked and /journal — do not fork.
 *
 * The sequence number lives in the rail on the left, and the rail segment takes
 * the row's verdict as a rule weight, so a column of refusals is visible down
 * the gutter before a word of it has been read.
 */
export function JournalEntry({
  row,
  topicId,
  defaultOpen = false,
}: {
  row: JournalRow;
  topicId: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const v = verdict(row);
  const body = row.body as ReceiptBody & BreachBody;
  const reason = row.type === "BREACH" ? body.detail : body.reason;
  const showCallout = !!row.context && v.label !== "approved";
  // A console row carries a local counter, not a consensus sequence. The rail
  // shows an em dash rather than a number that looks like Hedera's and is not.
  const offJournal = isConsoleRow(body);

  return (
    <SeqRail
      seq={offJournal ? null : row.seq}
      weight={v.weight}
      className="py-7"
    >
      <article>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <Tag tone={v.tone}>{v.label}</Tag>
          <time className="data text-micro text-slate-lit">{fmtUtc(row.ts)}</time>
        </div>

        <p className="mt-4 break-words font-serif text-[1.1875rem] leading-[1.45] text-signal">
          {reason}
        </p>

        <p className="data mt-3 break-all text-data text-slate-lit">
          {detailLine(row)}
        </p>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="mt-4 inline-flex items-center gap-2 font-sans text-data text-slate-lit transition-colors hover:text-signal"
        >
          <Chevron open={open} />
          {open ? "Hide the full receipt" : "Show the full receipt"}
        </button>

        {open && (
          <dl className="mt-5 grid grid-cols-[7.5rem_1fr] gap-x-5 gap-y-2 border-l border-hairline pl-5">
            <DataPair label="vault" value={row.vault} />
            <DataPair label="nonce" value={body.seq ?? body.nonce} />
            {row.type === "RECEIPT" && (
              <>
                <DataPair label="decision" value={body.decision} />
                <DataPair label="mandate" value={body.mandateHash} />
                <DataPair label="pool" value={body.poolId} />
                <DataPair label="params" value={body.paramsHash} />
                <DataPair label="signature" value={body.signature} tone="brass" />
                <DataPair label="source" value={body.source} />
              </>
            )}
            {row.type === "BREACH" && (
              <>
                <DataPair label="covenant" value={body.covenant} tone="refusal" />
                <dt className="font-sans text-data text-slate-lit">
                  transaction
                </dt>
                <dd className="data break-all text-data">
                  <ExternalLink href={hashscanTx(body.observedTxHash)}>
                    {body.observedTxHash}
                  </ExternalLink>
                </dd>
              </>
            )}
            <DataPair label="consensus" value={fmtUtc(row.ts)} />
            <dt className="font-sans text-data text-slate-lit">record</dt>
            <dd className="text-data">
              {offJournal ? (
                <span className="font-sans text-slate-lit">
                  not on the journal — the Validator answered, but only the
                  Manager appends to the topic
                </span>
              ) : (
                <span className="data text-brass">
                  <ExternalLink href={hashscanTopicMessage(topicId, row.seq)}>
                    topic message {row.seq} on HashScan
                  </ExternalLink>
                </span>
              )}
            </dd>
          </dl>
        )}

        {showCallout && row.context && (
          <div className="mt-6 border-l-2 border-oxblood-edge pl-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-sans text-data text-oxblood-lit">
                What the model saw
              </span>
              {row.context.injected && <Tag tone="injection">injection</Tag>}
            </div>
            <p className="mt-3 break-words font-serif text-[1.0625rem] italic leading-relaxed text-slate-lit">
              &ldquo;{row.context.reasoning}&rdquo;
            </p>
            <p className="mt-2 font-sans text-micro text-slate-lit">
              Proposed by {row.context.proposer}, and dropped at the boundary.
              The Validator was never sent it.
            </p>
            {open && (
              <p className="data mt-3 break-all text-micro text-slate-lit">
                {JSON.stringify(row.context.swapParams)}
              </p>
            )}
          </div>
        )}
      </article>
    </SeqRail>
  );
}
