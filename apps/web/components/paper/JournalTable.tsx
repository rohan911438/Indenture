"use client";

import { useMemo, useRef, useState } from "react";
import { gsap, useGSAP, prefersReducedMotion } from "@/components/motion/gsapPaper";
import { STAGGER, D, E } from "@/lib/motion";

export type JournalTableRow = {
  seq: number;
  time: string;
  nonce: string;
  type: string;
  pool: string;
  outcome: string;
  tone: "permit" | "refuse" | "neutral";
  href: string;
};

const FILTERS = [
  { id: "all", label: "All" },
  { id: "permit", label: "Executed" },
  { id: "refuse", label: "Refused & breached" },
] as const;

/**
 * The ledger.
 *
 * The stagger runs once, on first paint, and never on a refetch — a table that
 * re-animates every five seconds is a table nobody can read. Filtering is a
 * render, not a re-entrance, for the same reason.
 */
export function JournalTable({ rows }: { rows: JournalTableRow[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const body = useRef<HTMLTableSectionElement>(null);
  const played = useRef(false);

  const shown = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.tone === filter)),
    [rows, filter],
  );

  useGSAP(
    () => {
      if (played.current || prefersReducedMotion()) return;
      const el = body.current;
      if (!el) return;
      played.current = true;
      gsap.from(el.querySelectorAll("tr"), {
        opacity: 0,
        y: 8,
        duration: D.sm,
        ease: E.out,
        stagger: STAGGER.row,
      });
    },
    { scope: body },
  );

  return (
    <>
      <div className="filters" style={{ marginBottom: 32 }}>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className="pill"
            data-active={filter === f.id}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
            <span style={{ color: "var(--ink-3)", marginLeft: 8 }}>
              {f.id === "all" ? rows.length : rows.filter((r) => r.tone === f.id).length}
            </span>
          </button>
        ))}
      </div>

      <div className="dt__scroll">
        <table className="dt">
          <thead>
            <tr>
              <th>TIME</th>
              <th>NONCE</th>
              <th>TYPE</th>
              <th>POOL</th>
              <th>OUTCOME</th>
              <th>TX</th>
            </tr>
          </thead>
          <tbody ref={body}>
            {shown.map((r) => (
              <tr key={`${r.type}-${r.seq}`}>
                <td>{r.time}</td>
                <td>{r.nonce}</td>
                <td>{r.type}</td>
                <td>{r.pool}</td>
                <td style={{ color: r.tone === "refuse" ? "var(--refuse)" : "var(--ink-2)" }}>
                  <span
                    className="dot"
                    style={{
                      background:
                        r.tone === "permit"
                          ? "var(--permit)"
                          : r.tone === "refuse"
                            ? "var(--refuse)"
                            : "var(--ink-3)",
                    }}
                  />
                  {r.outcome}
                </td>
                <td>
                  <a href={r.href} target="_blank" rel="noreferrer" data-cursor="OPEN">
                    #{r.seq} ↗
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {shown.length === 0 && (
        <p className="t-small" style={{ marginTop: 32, color: "var(--ink-3)" }}>
          No entries of that kind yet.
        </p>
      )}
    </>
  );
}
