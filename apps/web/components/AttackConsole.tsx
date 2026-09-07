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

/** What /validate answers with — shared-contracts/validator-api.md. */
type ValidateResponse = {
  decision: "APPROVED" | "REFUSED";
  reason?: string;
  detail?: { covenant?: string };
  receipt?: { seq?: number; poolId?: string; paramsHash?: string; mandateHash?: string };
  signature?: string;
};

export function AttackConsole({
  scenarios,
  onResult,
  validatorUrl,
}: {
  scenarios: AttackScenario[];
  onResult: (row: JournalRow) => void;
  /** empty when no Validator is deployed yet */
  validatorUrl: string;
}) {
  const [phase, setPhase] = useState(-1); // -1 idle · 0..4 step · 5 done
  const [active, setActive] = useState<AttackScenario | null>(null);
  const [liveVerdict, setLiveVerdict] = useState<string | null>(null);
  const runs = useRef(0);
  const running = phase >= 0 && phase < STEPS.length;
  const live = validatorUrl.length > 0;

  /**
   * Send the proposal to the real Validator — and send ONLY
   * `{ poolId, swapParams }`.
   *
   * The injected reasoning is dropped right here, in the caller, which is the
   * entire demonstration: the attack text never reaches the service that
   * decides. Sending it and having the Validator ignore it would prove
   * something much weaker, and sending it under any other key is a 400 by
   * design (the request schema is strict).
   */
  async function ask(s: AttackScenario): Promise<ValidateResponse> {
    const res = await fetch(`${validatorUrl.replace(/\/$/, "")}/validate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ poolId: s.poolId, swapParams: s.swapParams }),
    });
    if (!res.ok) throw new Error(`validator answered ${res.status}`);
    return (await res.json()) as ValidateResponse;
  }

  async function run(s: AttackScenario) {
    if (running) return;
    runs.current += 1;
    setActive(s);
    setLiveVerdict(null);
    const gap = prefersReducedMotion() ? 120 : 650;

    // Ask the Validator while the steps animate, so the verdict on screen is
    // the one that came back rather than the one we expected.
    const answer: Promise<ValidateResponse | null> = live
      ? ask(s).catch((e: unknown) => {
          setLiveVerdict(`Validator unreachable — ${(e as Error).message}`);
          return null;
        })
      : Promise.resolve(null);

    for (let i = 0; i < STEPS.length; i++) {
      setPhase(i);
      await new Promise((r) => setTimeout(r, gap));
    }
    const real = await answer;
    setPhase(STEPS.length);

    const nonce = real?.receipt?.seq ?? 60 + runs.current;
    const decision = real?.decision ?? "REFUSED";
    if (real) setLiveVerdict(`${decision} — ${real.detail?.covenant ?? real.reason ?? ""}`);

    onResult({
      seq: 900 + runs.current,
      type: "RECEIPT",
      vault: VAULT,
      ts: Math.floor(Date.now() / 1000),
      body: {
        decision,
        reason: real?.reason ?? s.reason,
        seq: nonce,
        poolId: real?.receipt?.poolId ?? s.poolId,
        mandateHash: real?.receipt?.mandateHash ?? MANDATE_HASH,
        paramsHash: real?.receipt?.paramsHash ?? "0x" + "ef".repeat(31) + "01",
        ...(real?.signature ? { signature: real.signature } : {}),
        source: live ? "validator" : "rehearsal",
      },
      context: {
        proposer: s.proposer,
        nonce,
        poolId: s.poolId,
        swapParams: s.swapParams,
        // The reasoning is shown here because this is the journal's CONTEXT
        // record of what the model saw — not because it was sent anywhere.
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
              setLiveVerdict(null);
            }}
            className="font-mono text-xs text-slate hover:text-signal"
          >
            reset
          </button>
        )}
      </div>
      <p className="mt-2 font-sans text-sm text-slate">
        Fire a prompt-injection at the pipeline.{" "}
        {live ? (
          <>
            The proposal goes to the deployed Validator; only{" "}
            <span className="font-mono text-xs">{"{ poolId, swapParams }"}</span>{" "}
            crosses the boundary, and the verdict below is its answer.
          </>
        ) : (
          <span className="text-oxblood">
            No Validator is deployed yet — this is a scripted rehearsal of the
            same sequence, not a live refusal.
          </span>
        )}
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
                ? (liveVerdict ?? `REFUSED — ${active.covenant}`)
                : raw === "__journal__"
                  ? live
                    ? "Written to the journal topic, permanently"
                    : "Would be written to the journal topic — no topic yet"
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
