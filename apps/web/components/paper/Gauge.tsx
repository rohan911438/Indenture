"use client";

import { useRef } from "react";
import { gsap, useGSAP, prefersReducedMotion } from "@/components/motion/gsapPaper";
import { D, E } from "@/lib/motion";

/**
 * Headroom against a covenant.
 *
 * The colour is the judgement: healthy, watch it, or you are at the line. The
 * tick is the limit itself drawn on the track, because a bar without one can
 * only communicate "quite full" and the whole point here is what it is full of.
 *
 * A floor covenant is inverted — minCashBps is breached by being too LOW — so
 * the fill shows how much of the requirement is met rather than how much of an
 * allowance is spent.
 */
export function Gauge({
  label,
  current,
  limit,
  mode,
  format,
}: {
  label: string;
  current: number;
  limit: number;
  mode: "ceiling" | "floor";
  /** already-formatted current and limit, so this component owns no units */
  format: { current: string; limit: string; headroom: string };
}) {
  const ref = useRef<HTMLDivElement>(null);

  const ratio =
    limit === 0 ? 0 : mode === "ceiling" ? current / limit : Math.min(current / limit, 2) / 2;
  const pct = Math.max(0, Math.min(1, ratio));

  // Ceiling: close to the cap is bad. Floor: close to the floor is bad, and the
  // fill is already inverted, so the thresholds mirror.
  const tone =
    mode === "ceiling"
      ? pct >= 1
        ? "refuse"
        : pct > 0.8
          ? "watch"
          : "permit"
      : pct <= 0.5
        ? "refuse"
        : pct < 0.6
          ? "watch"
          : "permit";

  useGSAP(
    () => {
      const fill = ref.current?.querySelector<HTMLElement>(".gauge__fill");
      if (!fill) return;
      if (prefersReducedMotion()) {
        fill.style.transform = `scaleX(${pct})`;
        return;
      }
      const tween = gsap.fromTo(
        fill,
        { scaleX: 0 },
        {
          scaleX: pct,
          duration: D.lg,
          ease: E.out,
          scrollTrigger: { trigger: ref.current, start: "top 90%", once: true },
        },
      );
      return () => {
        tween.scrollTrigger?.kill();
        tween.kill();
      };
    },
    { scope: ref, dependencies: [pct] },
  );

  return (
    <div ref={ref}>
      <div className="flex items-baseline justify-between gap-4">
        <span className="t-data" style={{ color: "var(--ink)" }}>
          {label}
        </span>
        <span className="t-data" style={{ color: "var(--ink-2)" }}>
          {format.current}
        </span>
      </div>

      <div className="gauge__track" style={{ marginTop: 12 }}>
        <div
          className="gauge__fill"
          style={{ background: `var(--${tone})`, transform: "scaleX(0)" }}
        />
        {/* Floor covenants put the requirement at the halfway mark, so the tick
            sits where the fill must not fall below. */}
        <div className="gauge__tick" style={{ left: mode === "ceiling" ? "100%" : "50%" }} />
      </div>

      <div className="flex items-baseline justify-between gap-4" style={{ marginTop: 10 }}>
        <span className="t-data-sm" style={{ color: "var(--ink-3)" }}>
          {mode === "ceiling" ? "CAP" : "FLOOR"} {format.limit}
        </span>
        <span className="t-data-sm" style={{ color: `var(--${tone})` }}>
          {format.headroom}
        </span>
      </div>
    </div>
  );
}
