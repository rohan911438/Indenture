"use client";

import { useMemo, useState } from "react";
import type { JournalRow, ReceiptBody } from "@/lib/types";
import { JournalEntry } from "@/components/JournalEntry";
import { SeqRailHead } from "@/components/ui/SeqRail";
import { Rule } from "@/components/ui/Rule";

type Filter = "all" | "approved" | "refused" | "breach";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Everything" },
  { key: "approved", label: "Approved" },
  { key: "refused", label: "Refused" },
  { key: "breach", label: "Breaches" },
];

function matches(row: JournalRow, f: Filter): boolean {
  if (f === "all") return true;
  if (f === "breach") return row.type === "BREACH";
  return (
    row.type === "RECEIPT" &&
    (row.body as ReceiptBody).decision === f.toUpperCase()
  );
}

export function JournalList({
  rows,
  topicId,
}: {
  rows: JournalRow[];
  topicId: string;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const shown = useMemo(
    () => rows.filter((r) => matches(r, filter)),
    [rows, filter],
  );

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const count = rows.filter((r) => matches(r, f.key)).length;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              aria-pressed={active}
              className={
                "flex items-baseline gap-2 border px-3 py-1.5 font-sans text-data transition-colors duration-150 " +
                (active
                  ? "border-brass text-signal"
                  : "border-hairline text-slate-lit hover:border-slate hover:text-signal")
              }
            >
              {f.label}
              <span className="data text-micro text-slate-lit">{count}</span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <p className="prose-measure mt-10 font-serif text-[1.1875rem] italic text-slate-lit">
          No entry matches that filter. The journal holds {rows.length}{" "}
          {rows.length === 1 ? "record" : "records"} in total.
        </p>
      ) : (
        <div className="mt-10">
          <SeqRailHead topicId={topicId} />
          <Rule className="mt-3" />
          <div className="divide-y divide-hairline">
            {shown.map((row) => (
              <JournalEntry
                key={`${row.type}-${row.seq}`}
                row={row}
                topicId={topicId}
              />
            ))}
          </div>
          <Rule />
        </div>
      )}
    </div>
  );
}
