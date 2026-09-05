"use client";

import { useMemo, useState } from "react";
import type { JournalRow, ReceiptBody } from "@/lib/types";
import { JournalEntry } from "@/components/JournalEntry";

type Filter = "all" | "approved" | "refused" | "breach";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
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
                "border px-2.5 py-1 font-mono text-xs transition-colors " +
                (active
                  ? "border-brass text-signal"
                  : "border-hairline text-slate hover:text-signal")
              }
            >
              {f.label}{" "}
              <span className="text-slate tabular-nums">{count}</span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <p className="mt-8 font-serif italic text-[15px] text-slate">
          Nothing matches that filter yet.
        </p>
      ) : (
        <div className="mt-6 divide-y divide-hairline border-t border-hairline">
          {shown.map((row) => (
            <JournalEntry
              key={`${row.type}-${row.seq}`}
              row={row}
              topicId={topicId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
