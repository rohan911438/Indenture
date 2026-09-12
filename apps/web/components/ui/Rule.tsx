/**
 * A typed horizontal rule. The weight IS the information:
 *
 *   hair      row separation — one entry from the next
 *   covenant  a covenant boundary — brass, 2px, something is enforced here
 *   refusal   a refusal — oxblood, 2px, something was stopped here
 *
 * A component that needs a fourth weight needs a fourth meaning first.
 */
export type RuleWeight = "hair" | "covenant" | "refusal";

const WEIGHT: Record<RuleWeight, string> = {
  hair: "h-px bg-hairline",
  covenant: "h-0.5 bg-brass",
  refusal: "h-0.5 bg-oxblood-edge",
};

export function Rule({
  weight = "hair",
  className = "",
  onBone = false,
}: {
  weight?: RuleWeight;
  className?: string;
  /** on printed stock the hairline inverts */
  onBone?: boolean;
}) {
  const base =
    onBone && weight === "hair" ? "h-px bg-hairline-bone" : WEIGHT[weight];
  return <div role="presentation" className={`${base} ${className}`} />;
}
