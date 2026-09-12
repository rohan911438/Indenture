"use client";

import { useRef } from "react";
import { usePinnedSteps } from "@/components/motion/usePinnedSteps";
import { Shell } from "@/components/ui/Shell";

/**
 * The mental model, as three stations and the two boundaries between them.
 *
 * Rebuilt from a numbered list into a diagram, because the load-bearing fact
 * here is not the order of the steps — it is what does and does not cross each
 * gap. A list can only tell you that; showing the payload at each station, with
 * the reasoning struck out at the first boundary, is the argument itself.
 *
 * Numbering is honest here: it is a pipeline, and step two cannot happen before
 * step one.
 *
 * Pinned, the rail advances and the other stations recede. Not pinned — reduced
 * motion, no JavaScript, a small screen — all three are simply legible at once.
 * The DOM is identical either way; `pinned` only decides emphasis, so no station
 * is ever unreachable.
 */
const STEPS = [
  {
    title: "An untrusted agent proposes",
    body: "The manager is a language model with no authority at all. It emits a pool and a set of swap parameters, and separately, the reasoning that led it there.",
    payload: [
      { label: "emits", value: "poolId, swapParams", dropped: false },
      { label: "and", value: "its reasoning", dropped: true },
    ],
  },
  {
    title: "The Validator re-derives",
    body: "The mandate comes from its Hedera topic, the pool state from the chain, the prices from their Chainlink feeds. Then pure arithmetic produces a signed receipt or a refusal naming the covenant that stopped it.",
    payload: [
      { label: "receives", value: "poolId, swapParams", dropped: false },
      { label: "and nothing else", value: "a third field is a 400", dropped: false },
    ],
  },
  {
    title: "The decision is journaled",
    body: "Approved or refused, the verdict goes to the Hedera Consensus Service alongside the exact text the model saw. Nobody here can edit it afterwards, including us.",
    payload: [
      { label: "writes", value: "RECEIPT", dropped: false },
      { label: "alongside", value: "CONTEXT, the sentence", dropped: false },
    ],
  },
];

export function SystemSpine() {
  const root = useRef<HTMLElement>(null);
  const { step, pinned } = usePinnedSteps(root, STEPS.length, 0.6);

  return (
    <section
      ref={root}
      className={`flex flex-col justify-center ${
        pinned ? "min-h-screen py-10" : "py-movement"
      }`}
    >
      <Shell>
        <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
          <h2 className="heading text-signal">
            Three things happen to every trade
          </h2>
          <p className="font-sans text-data text-slate-lit">
            What crosses each boundary, and what does not
          </p>
        </div>

        <ol className="mt-14 grid grid-cols-1 gap-x-6 gap-y-12 lg:grid-cols-3">
          {STEPS.map((s, i) => {
            const current = !pinned || i === step;
            return (
              <li
                key={s.title}
                aria-current={pinned && i === step ? "step" : undefined}
                className={`transition-opacity duration-500 ease-press ${
                  current ? "opacity-100" : "opacity-30"
                }`}
              >
                {/* the rail for this station: brass once reached */}
                <div
                  aria-hidden
                  className={`h-0.5 transition-colors duration-500 ${
                    !pinned || i <= step ? "bg-brass" : "bg-hairline"
                  }`}
                />

                <div className="mt-5 flex items-baseline gap-3">
                  <span
                    className={`font-serif text-[1.5rem] italic leading-none ${
                      current ? "text-brass" : "text-slate"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <h3 className="subheading text-signal">{s.title}</h3>
                </div>

                <p className="mt-4 text-meta text-slate-lit">{s.body}</p>

                {/* the payload — the part that is actually the argument */}
                <dl className="mt-6 space-y-2">
                  {s.payload.map((pl) => (
                    <div key={pl.label} className="flex flex-wrap items-baseline gap-x-2">
                      <dt className="font-sans text-micro text-slate">
                        {pl.label}
                      </dt>
                      <dd
                        className={`data text-data ${
                          pl.dropped
                            ? "text-slate line-through decoration-oxblood-edge"
                            : "text-brass"
                        }`}
                      >
                        {pl.value}
                      </dd>
                      {pl.dropped && (
                        <dd className="font-sans text-micro text-oxblood-lit">
                          dropped at the boundary
                        </dd>
                      )}
                    </div>
                  ))}
                </dl>
              </li>
            );
          })}
        </ol>
      </Shell>
    </section>
  );
}
