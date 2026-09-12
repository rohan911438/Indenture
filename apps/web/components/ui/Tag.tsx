/**
 * A status label on a record: approved, refused, breach, injection.
 *
 * Lower case and bordered, not a tracked-out capital eyebrow — this labels a
 * row's state, which is data, rather than announcing the section it sits in.
 */
export type TagTone = "approved" | "refused" | "breach" | "injection" | "neutral";

const TONE: Record<TagTone, string> = {
  approved: "border-brass text-brass",
  refused: "border-oxblood-edge text-oxblood-lit",
  breach: "border-oxblood-edge text-oxblood-lit",
  injection: "border-oxblood-edge text-oxblood-lit",
  neutral: "border-hairline text-slate-lit",
};

export function Tag({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: TagTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-block border px-1.5 py-0.5 font-sans text-micro ${TONE[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
