"use client";

import { useEffect, useRef, useState } from "react";
import type { CovenantStatus } from "@/lib/data";

function fmt(value: number, unit: CovenantStatus["unit"]): string {
  if (unit === "usdc6") {
    return "$" + Math.round(value / 1_000_000).toLocaleString("en-US");
  }
  return (value / 100).toFixed(value % 100 === 0 ? 0 : 2) + "%";
}

/**
 * One covenant, against its limit.
 *
 * The limit is drawn as a brass rule at the end of the track, which is the
 * site's rule vocabulary doing its job: a 2px brass edge means a covenant
 * boundary wherever it appears. So the gauge is not a progress bar that happens
 * to stop — it is a measurement against a wall you can see.
 *
 * ceiling mode fills on current / limit. floor mode fills on limit / current,
 * so in both cases a fuller bar means less headroom. Past 85% the fill and the
 * wall both turn oxblood.
 *
 * The fill is this component's one motion moment, and it runs when the gauge
 * scrolls into view rather than on mount, because these now sit below the fold.
 * The global reduced-motion rule zeroes the transition, so under `reduce` the
 * bar is simply already at its value.
 */
export function CovenantGauge({ status }: { status: CovenantStatus }) {
  const raw =
    status.mode === "floor"
      ? status.limit / Math.max(status.current, 1)
      : status.current / Math.max(status.limit, 1);
  const target = Math.max(0, Math.min(1, raw));
  const pct = Math.round(target * 100);
  const danger = target > 0.85;

  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setWidth(target);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setWidth(target);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -15% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [target]);

  return (
    <div ref={ref}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="font-sans text-meta text-signal">{status.label}</span>
        <span className="data text-data text-slate-lit">
          {fmt(status.current, status.unit)}{" "}
          <span className="text-slate">
            {status.mode === "floor" ? "against a floor of" : "of"}
          </span>{" "}
          {fmt(status.limit, status.unit)}
        </span>
      </div>

      <div className="mt-3 flex items-stretch">
        <div
          className="relative h-1.5 w-full bg-hairline"
          role="meter"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${status.label}, ${pct}% of its ${
            status.mode === "floor" ? "floor" : "limit"
          }`}
        >
          <div
            className="h-full transition-[width] duration-[900ms] ease-press"
            style={{
              width: `${width * 100}%`,
              background: danger ? "var(--oxblood-edge)" : "var(--brass)",
            }}
          />
        </div>
        {/* the wall. A covenant boundary, in the weight that always means one. */}
        <div
          aria-hidden
          className="w-0.5 shrink-0"
          style={{ background: danger ? "var(--oxblood-edge)" : "var(--brass)" }}
        />
      </div>

      <p
        className={
          "mt-2 font-sans text-micro " +
          (danger ? "text-oxblood-lit" : "text-slate-lit")
        }
      >
        {danger
          ? `${100 - pct}% of headroom left — close to the limit`
          : `${100 - pct}% headroom`}
      </p>
    </div>
  );
}
