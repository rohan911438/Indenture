"use client";

import { useRef, useState } from "react";
import type { AttackScenario } from "@/lib/data";
import type { JournalRow } from "@/lib/types";
import { Rule } from "@/components/ui/Rule";
import { Tag } from "@/components/ui/Tag";

const MANDATE_HASH =
  "0x5b2aa6b40d6994afed27c26457c470d6fe4fa9c47622cbe388e20e1b29b19c75";
const VAULT = "0x00000000000000000000000000000000000000b0";

const STEPS = [
  "The manager emits a proposal with its reasoning attached",
  "The free text is dropped at the boundary — the Validator is handed only { poolId, swapParams }",
  "The Validator re-derives the mandate, the pool state and the price feed from source",
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

/** pending · running · done — the mark says which, without a decorative tick. */
function StepMark({ state }: { state: "pending" | "running" | "done" | "refused" }) {
  const cls =
    state === "done"
      ? "bg-brass border-brass"
      : state === "refused"
        ? "bg-oxblood-edge border-oxblood-edge"
        : state === "running"
          ? "animate-pulse bg-slate border-slate"
          : "border-hairline";
  return (
    <span
      aria-hidden
      className={`mt-[0.42rem] h-2 w-2 shrink-0 border ${cls}`}
    />
  );
}

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

    // Ask the Validator while the steps advance, so the verdict on screen is
    // the one that came back rather than the one we expected.
    const answer: Promise<ValidateResponse | null> = live
      ? ask(s).catch((e: unknown) => {
          setLiveVerdict(`The Validator could not be reached — ${(e as Error).message}`);
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

    /**
     * Take the verdict WHOLE from whichever source gave it.
     *
     * The previous version read `decision` off the live answer but fell back to
     * the fixture for `reason`, so a live APPROVED could be shown wearing the
     * fixture's refusal text. A verdict assembled from two sources is not a
     * verdict either of them gave, and this page's entire argument is that the
     * record says what actually happened.
     */
    const decision = real ? real.decision : "REFUSED";
    const reason = real
      ? (real.reason ??
        (real.decision === "APPROVED"
          ? "Within every covenant — the Validator signed it."
          : "Refused, with no reason given."))
      : s.reason;
    if (real) {
      setLiveVerdict(
        real.decision === "APPROVED"
          ? `Approved — ${real.reason ?? "the trade itself is inside every covenant"}`
          : `Refused — ${real.detail?.covenant ?? real.reason ?? ""}`,
      );
    }

    onResult({
      seq: 900 + runs.current,
      type: "RECEIPT",
      vault: VAULT,
      ts: Math.floor(Date.now() / 1000),
      body: {
        decision,
        reason,
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
    <section className="border border-hairline bg-ink-raised/40 p-6 sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 className="subheading text-signal">Fire one yourself</h2>
        {phase === STEPS.length && (
          <button
            onClick={() => {
              setPhase(-1);
              setActive(null);
              setLiveVerdict(null);
            }}
            className="font-sans text-data text-slate-lit transition-colors hover:text-signal"
          >
            Clear and start again
          </button>
        )}
      </div>

      <p className="prose-measure mt-4 text-slate-lit">
        {live ? (
          <>
            The proposal goes to the deployed Validator, and only{" "}
            <span className="data text-signal">{"{ poolId, swapParams }"}</span>{" "}
            crosses the boundary. The verdict below is its answer, not ours.{" "}
            <span className="text-slate-lit">
              Whether a proposal is refused depends on the fund&rsquo;s state at
              the moment you fire it, not on the button you pressed — the
              stale-price one is only refused while the price feed actually is
              stale.
            </span>
          </>
        ) : (
          <span className="text-oxblood-lit">
            No Validator is deployed, so this runs the same sequence as a
            rehearsal. It is not a live refusal, and the entry it writes below
            will say so.
          </span>
        )}
      </p>

      <div className="mt-7 flex flex-wrap gap-3">
        {scenarios.map((s) => (
          <button
            key={s.id}
            disabled={running}
            onClick={() => run(s)}
            className={
              "border px-4 py-2 font-sans text-meta transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-30 " +
              (active?.id === s.id
                ? "border-oxblood-edge text-oxblood-lit"
                : "border-hairline text-signal hover:border-slate")
            }
          >
            {s.title}
          </button>
        ))}
      </div>

      {phase >= 0 && active && (
        <>
          <Rule className="mt-8" />
          <ol className="mt-6 space-y-3">
            {STEPS.map((raw, i) => {
              const isVerdict = raw === "__verdict__";
              const line =
                isVerdict
                  ? (liveVerdict ?? `Refused — ${active.covenant}`)
                  : raw === "__journal__"
                    ? live
                      ? "Written to the journal topic, permanently"
                      : "Would be written to the journal topic — there is no topic to write to"
                    : raw;
              const done = phase > i || phase === STEPS.length;
              const now = phase === i;
              // An approval is not a refusal wearing the same colour.
              const approved = isVerdict && /^Approved/.test(liveVerdict ?? "");
              return (
                <li key={i} className="flex gap-3">
                  <StepMark
                    state={
                      done
                        ? isVerdict && !approved
                          ? "refused"
                          : "done"
                        : now
                          ? "running"
                          : "pending"
                    }
                  />
                  <span
                    className={
                      "font-sans text-meta " +
                      (done
                        ? isVerdict
                          ? approved
                            ? "text-brass"
                            : "text-oxblood-lit"
                          : "text-signal"
                        : now
                          ? "text-slate-lit"
                          : "text-slate")
                    }
                  >
                    {line}
                  </span>
                </li>
              );
            })}
          </ol>
        </>
      )}

      {phase === STEPS.length && (
        <div className="mt-7 flex flex-wrap items-center gap-3">
          {/^Approved/.test(liveVerdict ?? "") ? (
            <>
              <Tag tone="approved">signed</Tag>
              <p className="prose-measure font-sans text-meta text-slate-lit">
                The Validator signed this one. The injected sentence changed
                nothing either way — it never reached the Validator, and the
                trade underneath it was inside every covenant.
              </p>
            </>
          ) : (
            <>
              <Tag tone="refused">blocked</Tag>
              <p className="font-sans text-meta text-slate-lit">
                The refusal and the exact text the model saw are on the record
                below.
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
