/**
 * One measured figure. Mono and tabular because it is data; the label is sans
 * because a label is not. Sized so a column of these reads as a ledger rather
 * than as a row of marketing stats.
 */
export function Figure({
  value,
  label,
  tone = "signal",
  size = "md",
  note,
}: {
  value: string;
  label: string;
  tone?: "signal" | "brass" | "refusal";
  size?: "md" | "lg";
  /** provenance for THIS figure, when it differs from the ones beside it */
  note?: string;
}) {
  const color =
    tone === "brass"
      ? "text-brass"
      : tone === "refusal"
        ? "text-oxblood-lit"
        : "text-signal";
  const scale =
    size === "lg"
      ? "text-[clamp(2rem,3.4vw,2.75rem)]"
      : "text-[clamp(1.5rem,2.4vw,2rem)]";
  return (
    <div>
      <div className={`data leading-none ${scale} ${color}`}>{value}</div>
      <div className="mt-2 font-sans text-data text-slate-lit">{label}</div>
      {note && (
        <div className="mt-1 max-w-[18ch] font-sans text-micro text-oxblood-lit">
          {note}
        </div>
      )}
    </div>
  );
}
