/**
 * One key and one value from a record. The value is mono because it IS data —
 * a hash, an address, a nonce, a figure. The key is sans, because a label is
 * not data.
 */
export function DataPair({
  label,
  value,
  tone = "signal",
}: {
  label: string;
  value?: string | number | boolean | null;
  tone?: "signal" | "brass" | "refusal";
}) {
  if (value === undefined || value === null || value === "") return null;
  const color =
    tone === "brass"
      ? "text-brass"
      : tone === "refusal"
        ? "text-oxblood-lit"
        : "text-signal";
  return (
    <>
      <dt className="font-sans text-data text-slate-lit">{label}</dt>
      <dd className={`data text-data break-all ${color}`}>{String(value)}</dd>
    </>
  );
}
