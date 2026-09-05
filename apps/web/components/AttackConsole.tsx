"use client";

import { useRef, useState } from "react";
import type { AttackScenario } from "@/lib/data";
import type { JournalRow } from "@/lib/types";

const MANDATE_HASH =
  "0x5b2aa6b40d6994afed27c26457c470d6fe4fa9c47622cbe388e20e1b29b19c75";
const VAULT = "0x00000000000000000000000000000000000000b0";

const STEPS = [
  "LlmProposer emits a proposal with attached reasoning",
  "Free text dropped at the boundary — Validator receives only { poolId, swapParams }",
  "Validator re-derives the mandate, pool state and price feed from source",
  "__verdict__",
  "__journal__",
] as const;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

export function AttackConsole({
  scenarios,
  onResult,
}: {
  scenarios: AttackScenario[];
  onResult: (row: JournalRow) => void;
}) {
  const [phase, setPhase] = useState(-1); // -1 idle · 0..4 step · 5 done
  const [active, setActive] = useState<AttackScenario | null>(null);
  const runs = useRef(0);
  const running = phase >= 0 && phase < STEPS.length;

  async function run(s: AttackScenario) {
    if (running) return;
    runs.current += 1;
    const nonce = 60 + runs.current;
    setActive(s);
    const gap = prefersReducedMotion() ? 120 : 650;

    for (let i = 0; i < STEPS.length; i++) {
      setPhase(i);
      await new Promise((r) => setTimeout(r, gap));
    }
    setPhase(STEPS.length);

    onResult({
      seq: 900 + runs.current,
      type: "RECEIPT",
      vault: VAULT,
      ts: Math.floor(Date.now() / 1000),
      body: {
        decision: "REFUSED",
        reason: s.reason,
        seq: nonce,
        poolId: s.poolId,
        mandateHash: MANDATE_HASH,
        paramsHash: "0x" + "ef".repeat(31) + "01",
      },
      context: {
        proposer: s.proposer,
        nonce,
        poolId: s.poolId,
        swapParams: s.swapParams,
        reasoning: s.injectedReasoning,
        injected: true,
      },
    });
  }

  return (
    <section className="border border-hairline p-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-slate">
          Attack console
        </h2>
        {phase === STEPS.length && (
          <button
            onClick={() => {
              setPhase(-1);
              setActive(null);
            }}
            className="font-mono text-xs text-slate hover:text-signal"
          >
            reset
          </button>
        )}
      </div>
      <p className="mt-2 font-sans text-sm text-slate">
        Fire a prompt-injection at the pipeline. Simulated locally — the same
        path runs against the deployed Validator.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {scenarios.map((s) => (
          <button
            key={s.id}
            disabled={running}
            onClick={() => run(s)}
            className={
              "border px-3 py-1.5 font-sans text-sm transition-colors disabled:opacity-30 " +
              (active?.id === s.id
                ? "border-oxblood text-oxblood"
                : "border-hairline text-signal hover:border-slate")
            }
          >
            {s.title}
          </button>
        ))}
      </div>

      {phase >= 0 && active && (
        <ol className="mt-5 space-y-1.5">
          {STEPS.map((raw, i) => {
            const line =
              raw === "__verdict__"
                ? `REFUSED — ${active.covenant}`
                : raw === "__journal__"
                  ? "Written to the journal topic, permanently"
                  : raw;
            const done = phase > i || phase === STEPS.length;
            const now = phase === i;
            const verdict = raw === "__verdict__";
            return (
              <li
                key={i}
                className={
                  "font-mono text-xs flex gap-2 " +
                  (done
                    ? verdict
                      ? "text-oxblood"
                      : "text-signal"
                    : now
                      ? "text-slate animate-pulse"
                      : "text-slate/40")
                }
              >
                <span aria-hidden>{done ? "✓" : now ? "…" : "·"}</span>
                <span>{line}</span>
              </li>
            );
          })}
        </ol>
      )}

      {phase === STEPS.length && (
        <p className="mt-4 font-serif italic text-[15px] text-slate">
          Blocked. The refusal and the exact text the model saw are on the wall
          below.
        </p>
      )}
    </section>
  );
}
