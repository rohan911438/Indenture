import { Ticker } from "@/components/motion/Ticker";

export type TickerFigure = { text: string; tone?: "permit" };

/**
 * The line across the top of the page.
 *
 * Every figure on it is counted from the same journal the rest of the site
 * reads, so it cannot drift from what /blocked shows. Only one is coloured,
 * and it is the one that is zero: every other number here counts something
 * that happened, that one counts something that did not.
 */
export function TickerBar({ figures }: { figures: TickerFigure[] }) {
  return (
    <Ticker seconds={28}>
      {/* Rendered twice by Ticker, so this run must butt against itself
          without a visible seam — hence the trailing separator. */}
      {figures.map((f, i) => (
        <span
          key={i}
          className="ticker__item t-data-sm"
          style={{ color: f.tone === "permit" ? "var(--permit)" : "var(--on-dark)" }}
        >
          {f.text}
          <span style={{ color: "var(--on-dark-2)", marginLeft: 20 }}>·</span>
        </span>
      ))}
    </Ticker>
  );
}
