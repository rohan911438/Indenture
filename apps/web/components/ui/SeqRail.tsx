import type { RuleWeight } from "@/components/ui/Rule";

/**
 * The sequence rail, for /journal and /blocked only.
 *
 * Numbering is justified on exactly these two pages because the content
 * genuinely IS a sequence — these are real Hedera Consensus Service sequence
 * numbers, the order the network agreed, not decorative 01 / 02 / 03. It
 * appears nowhere else on the site.
 *
 * The rail segment carries the row's verdict as a rule weight, so the whole
 * wall is scannable down the gutter before you read a word of it.
 */
export function SeqRail({
  seq,
  weight = "hair",
  children,
  className = "",
}: {
  /** null for a row that has no consensus sequence — see lib/format isConsoleRow */
  seq: number | null;
  weight?: RuleWeight;
  children: React.ReactNode;
  className?: string;
}) {
  const rail =
    weight === "refusal"
      ? "bg-oxblood-edge w-0.5"
      : weight === "covenant"
        ? "bg-brass w-0.5"
        : "bg-hairline w-px";

  return (
    <div
      className={`grid grid-cols-[3.25rem_1fr] gap-x-4 sm:grid-cols-[4.5rem_1fr] sm:gap-x-6 ${className}`}
    >
      {/* no top padding of its own — the row supplies it, so the number sits
          on the same line as the verdict tag it labels */}
      <div className="relative flex justify-end">
        <span
          className="data text-data text-slate-lit"
          title={seq === null ? "no consensus sequence" : undefined}
        >
          {seq ?? "—"}
        </span>
        {/* the rail itself, running the full height of the row */}
        <span
          aria-hidden
          className={`absolute -right-2 top-0 h-full sm:-right-3 ${rail}`}
        />
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/**
 * The rail's own column heading — used once at the top of a list so the bare
 * numbers in the gutter are identified as what they are.
 */
export function SeqRailHead({ topicId }: { topicId: string }) {
  return (
    <div className="grid grid-cols-[3.25rem_1fr] gap-x-4 sm:grid-cols-[4.5rem_1fr] sm:gap-x-6">
      <div className="flex justify-end">
        <span className="font-sans text-micro text-slate">seq</span>
      </div>
      <div className="font-sans text-micro text-slate">
        consensus order on topic {topicId || "(unset)"}
      </div>
    </div>
  );
}
