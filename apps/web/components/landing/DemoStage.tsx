"use client";

import Link from "next/link";
import { useRef } from "react";
import { usePinnedSteps } from "@/components/motion/usePinnedSteps";
import { Rule } from "@/components/ui/Rule";
import { Shell } from "@/components/ui/Shell";
import { Tag } from "@/components/ui/Tag";

/**
 * The centrepiece: one refusal, taken apart.
 *
 * The diagram IS the argument. Two columns — what the manager sent, what the
 * Validator received — with the boundary drawn between them as a real rule. The
 * injected sentence sits on the left and visibly does not cross it. Everything
 * that does cross is named, and there are only two things.
 *
 * Pinned, the reader scrubs through the five stages. Unpinned it is a static
 * diagram with every stage visible at once, which is the form it has to survive
 * in anyway: reduced motion, no JavaScript, a phone.
 */
export interface DemoSubject {
  reasoning: string;
  reason: string;
  covenant: string;
  poolId: string;
  swapParams: {
    zeroForOne: boolean;
    amountSpecified: string;
    sqrtPriceLimitX96: string;
  };
  /** the HCS sequence number, when this is a real journaled refusal */
  seq: number | null;
  /** true when this came off the journal rather than out of the fixtures */
  live: boolean;
}

const SOURCES = [
  {
    name: "the mandate",
    detail: "read back from its Hedera topic and re-hashed, not taken on trust",
  },
  {
    name: "the pool",
    detail: "read from the PoolManager at the current block",
  },
  {
    name: "the prices",
    detail:
      "Chainlink rounds, each one aged against the tolerance the mandate itself sets",
  },
];

export function DemoStage({ subject }: { subject: DemoSubject }) {
  const root = useRef<HTMLElement>(null);
  // 0 propose · 1 boundary · 2 re-derive · 3 verdict · 4 journal
  const { step, pinned } = usePinnedSteps(root, 5, 0.5);

  const at = (n: number) => !pinned || step >= n;
  const dim = (n: number) => (at(n) ? "opacity-100" : "opacity-20 translate-y-1");

  return (
    <section
      ref={root}
      // While pinned the section IS the viewport, so the page rhythm padding
      // would push the verdict off the bottom edge with no way to reach it.
      className={`flex flex-col justify-center overflow-hidden ${
        pinned ? "min-h-screen py-10" : "py-movement"
      }`}
    >
      <Shell>
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <h2 className="heading text-signal">One refusal, taken apart</h2>
          <p className="font-sans text-data text-slate-lit">
            {subject.live ? (
              <>
                A refusal from the journal
                {subject.seq !== null && (
                  <>
                    , sequence{" "}
                    <span className="data text-signal">{subject.seq}</span>
                  </>
                )}
                .
              </>
            ) : (
              <span className="text-oxblood-lit">
                Nothing has been refused on the journal yet, so this is the
                recorded sequence for one of the injections rather than a live
                verdict.
              </span>
            )}
          </p>
        </div>

        <Rule className="mt-6" />

        <div className="mt-10 grid grid-cols-1 gap-y-10 lg:grid-cols-[1fr_auto_1fr] lg:gap-x-10">
          {/* --- what the manager sent ------------------------------------ */}
          <div className="min-w-0">
            <h3 className="font-sans text-data text-slate-lit">
              What the manager sent
            </h3>

            <div className={`mt-5 transition-all duration-500 ease-press ${dim(0)}`}>
              <Tag tone="injection">its reasoning</Tag>
              <p
                className={`mt-3 break-words border-l-2 border-oxblood-edge pl-4 font-serif text-[1.0625rem] italic leading-relaxed transition-colors duration-500 ${
                  at(1)
                    ? "text-slate line-through decoration-oxblood-edge"
                    : "text-signal"
                }`}
              >
                &ldquo;{subject.reasoning}&rdquo;
              </p>
              <p
                className={`mt-3 pl-4 font-sans text-data transition-opacity duration-500 ${
                  at(1) ? "text-oxblood-lit opacity-100" : "opacity-0"
                }`}
              >
                Dropped here. The Validator has no field to put this in.
              </p>
            </div>

            <div className={`mt-8 transition-all duration-500 ease-press ${dim(0)}`}>
              <Tag>its proposal</Tag>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-l-2 border-brass pl-4">
                <dt className="font-sans text-data text-slate-lit">pool</dt>
                <dd className="data break-all text-data text-signal">
                  {subject.poolId}
                </dd>
                <dt className="font-sans text-data text-slate-lit">amount</dt>
                <dd className="data break-all text-data text-signal">
                  {subject.swapParams.amountSpecified}
                </dd>
                <dt className="font-sans text-data text-slate-lit">direction</dt>
                <dd className="data text-data text-signal">
                  {subject.swapParams.zeroForOne ? "zeroForOne" : "oneForZero"}
                </dd>
              </dl>
            </div>
          </div>

          {/* --- the boundary -------------------------------------------- */}
          <div
            aria-hidden
            className="relative hidden w-px self-stretch bg-hairline lg:block"
          >
            <span
              className={`absolute left-0 top-1/2 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-brass transition-all duration-700 ease-press ${
                at(1) ? "h-28 opacity-100" : "h-0 opacity-0"
              }`}
            />
            <span className="absolute left-0 top-1/2 origin-left -translate-y-1/2 translate-x-3 -rotate-90 whitespace-nowrap font-sans text-micro text-slate">
              the boundary
            </span>
          </div>
          <Rule className="lg:hidden" />

          {/* --- what the Validator received ----------------------------- */}
          <div className="min-w-0">
            <h3 className="font-sans text-data text-slate-lit">
              What the Validator received
            </h3>

            <div className={`mt-5 transition-all duration-500 ease-press ${dim(1)}`}>
              <p className="font-sans text-meta text-signal">
                Two fields, and nowhere to say anything else. The request schema
                refuses a third.
              </p>
              <p className="data mt-3 overflow-x-auto border-l-2 border-brass pl-4 text-data text-brass">
                &#123; poolId, swapParams &#125;
              </p>
            </div>

            <ol
              className={`mt-8 space-y-3 transition-all duration-500 ease-press ${dim(2)}`}
            >
              {SOURCES.map((s) => (
                <li key={s.name} className="flex gap-3">
                  <span
                    aria-hidden
                    className="mt-[0.55rem] h-px w-4 shrink-0 bg-brass"
                  />
                  <p className="font-sans text-meta text-slate-lit">
                    <span className="text-signal">{s.name}</span> — {s.detail}
                  </p>
                </li>
              ))}
            </ol>

            <div className={`mt-8 transition-all duration-500 ease-press ${dim(3)}`}>
              <Rule weight="refusal" />
              <p className="mt-5 font-serif text-[clamp(2rem,4vw,3rem)] leading-none text-oxblood-lit">
                Refused
              </p>
              <div className="mt-4">
                <Tag tone="refused">{subject.covenant}</Tag>
              </div>
              <p className="data mt-4 break-words text-data text-signal">
                {subject.reason}
              </p>
            </div>

            <div className={`mt-8 transition-all duration-500 ease-press ${dim(4)}`}>
              <p className="prose-measure font-sans text-meta text-slate-lit">
                Written to the journal topic alongside the sentence that caused
                it, in the order the network agreed. Nothing here can revise it
                afterwards.
              </p>
              <Link
                href="/blocked"
                className="link mt-4 inline-block font-sans text-meta text-brass"
              >
                Fire this at the live Validator
              </Link>
            </div>
          </div>
        </div>
      </Shell>
    </section>
  );
}
