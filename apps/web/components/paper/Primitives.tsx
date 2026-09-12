import type { ReactNode } from "react";

/**
 * The paper system's primitives.
 *
 * They live in their own namespace rather than components/ui because that
 * folder belongs to the older ink/bone system that /mandate, /journal,
 * /blocked and /shares still read — fourteen files import its Rule alone.
 * Two systems, no collisions, until the later phases converge them.
 */

/**
 * A section rule. Full-bleed: it spans the viewport, not the column.
 *
 * This is the most recognisable detail of the layout and it is wrong the moment
 * it is inset, so the element is deliberately rendered OUTSIDE .shell and takes
 * no width prop to get that wrong with.
 */
export function Rule() {
  return <hr className="bleed-rule" role="presentation" />;
}

export function Eyebrow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={`t-eyebrow ${className}`}>{children}</p>;
}

export type ChipStatus = "permit" | "refuse" | "watch" | "neutral";

/** Status, never a control. Chips have no hover state on purpose. */
export function Chip({
  status = "neutral",
  children,
}: {
  status?: ChipStatus;
  children: ReactNode;
}) {
  return (
    <span className="chip" data-status={status}>
      {children}
    </span>
  );
}

export function Panel({
  label,
  chip,
  children,
  className = "",
  style,
}: {
  /** turns on the 44px header bar */
  label?: string;
  chip?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`panel ${className}`} style={style}>
      {label && (
        <div className="panel__bar">
          <span className="t-data-sm" style={{ color: "var(--ink-3)" }}>
            {label}
          </span>
          {chip}
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * One container, two internal dividers. Never three cards with gaps — that
 * single substitution is what turns this layout into a template.
 */
export function Triptych({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`triptych ${className}`}>{children}</div>;
}

export function TriptychCell({ children }: { children: ReactNode }) {
  return <div className="triptych__cell">{children}</div>;
}

/** A figure, its unit, and what it counts. */
export function Metric({
  value,
  unit,
  caption,
}: {
  value: ReactNode;
  unit?: string;
  caption: string;
}) {
  return (
    <div>
      <p className="t-numeral" style={{ color: "var(--ink)" }}>
        {value}
        {unit && (
          <span className="t-data-sm" style={{ marginLeft: 6, color: "var(--ink-2)" }}>
            {unit}
          </span>
        )}
      </p>
      <p className="t-data-sm" style={{ marginTop: 16, color: "var(--ink-3)" }}>
        {caption}
      </p>
    </div>
  );
}
