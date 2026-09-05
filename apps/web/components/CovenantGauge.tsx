"use client";

import { useEffect, useState } from "react";
import type { CovenantStatus } from "@/lib/data";

function fmt(value: number, unit: CovenantStatus["unit"]): string {
  if (unit === "usdc6") {
    return "$" + Math.round(value / 1_000_000).toLocaleString("en-US");
  }
  return value.toLocaleString("en-US") + " bps";
}

/**
 * label · current / limit · a hairline track with a fill.
 * ceiling mode: fill = current / limit.  floor mode: fill = limit / current.
 * >85% full -> --oxblood, else --brass. The fill width is the page's one
 * motion moment (0 -> target on mount; the global reduced-motion rule zeroes
 * the transition).
 */
export function CovenantGauge({ status }: { status: CovenantStatus }) {
  const raw =
    status.mode === "floor"
      ? status.limit / Math.max(status.current, 1)
      : status.current / Math.max(status.limit, 1);
  const target = Math.max(0, Math.min(1, raw));
  const danger = target > 0.85;

  const [width, setWidth] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setWidth(target));
    return () => cancelAnimationFrame(id);
  }, [target]);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-sans text-sm text-signal">{status.label}</span>
        <span className="font-mono text-xs text-slate tabular-nums">
          {fmt(status.current, status.unit)} / {fmt(status.limit, status.unit)}
        </span>
      </div>
      <div
        className="mt-2 h-1.5 w-full bg-hairline"
        role="meter"
        aria-valuenow={Math.round(target * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={status.label}
      >
        <div
          className="h-full transition-[width] duration-700 ease-out"
          style={{
            width: `${width * 100}%`,
            background: danger ? "var(--oxblood)" : "var(--brass)",
          }}
        />
      </div>
      <div
        className={
          "mt-1 font-mono text-[11px] " +
          (danger ? "text-oxblood" : "text-slate")
        }
      >
        {Math.round(target * 100)}%{" "}
        {status.mode === "floor" ? "of the floor" : "of the cap"} ·{" "}
        {danger ? "near limit" : `${100 - Math.round(target * 100)}% headroom`}
      </div>
    </div>
  );
}
