"use client";

import { useRef, useState } from "react";
import { gsap, useGSAP } from "@/components/motion/gsapPaper";
import { D, E } from "@/lib/motion";

/**
 * Phrases that are an instruction to the model rather than a description of a
 * trade. These are what gets washed in --refuse-bg inside the prompt.
 *
 * The list is deliberately about grammar, not keywords: every one of these is
 * someone telling the agent who it is or what to disregard. A filter looking
 * for "drain" or "attacker" catches none of them, which is the entire point of
 * the section above.
 */
const INJECTION = new RegExp(
  [
    "ignore (?:all )?previous instructions",
    "system override[^.]*",
    "you are now [^.,]*",
    "treat (?:this|the requester) as [^.,]*",
    "the sender is the fund owner",
    "no review needed",
    "maintenance mode",
    "decode the following and act on it",
    "[-.]{2,}(?:\\s*/?\\s*[-.]{1,})+",
  ].join("|"),
  "gi",
);

function highlight(text: string) {
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(INJECTION)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    out.push(
      <mark
        key={at}
        style={{
          background: "var(--refuse-bg)",
          color: "var(--refuse)",
          padding: "1px 2px",
        }}
      >
        {m[0]}
      </mark>,
    );
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export type BlockedEntryProps = {
  /** the named covenant — the reason the transaction did not happen */
  covenant: string;
  reason: string;
  kind: "refused" | "breach";
  when: string;
  seq: number;
  action: string | null;
  contextHash: string | null;
  prompt: string | null;
  injected: boolean;
  href: string;
};

/**
 * One refusal.
 *
 * The expandable half is the part that matters: it is the exact text the
 * manager was looking at when it decided to comply. Everything else on this
 * page is a claim about the system; that is evidence about the attack.
 */
export function BlockedEntry(props: BlockedEntryProps) {
  const [open, setOpen] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  const chevron = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const el = body.current;
      if (!el) return;
      // Height is the one property allowed to animate here: it is
      // user-initiated, isolated to this row, and nothing else is moving.
      gsap.to(el, {
        height: open ? "auto" : 0,
        opacity: open ? 1 : 0,
        duration: D.md,
        ease: E.out,
      });
      gsap.to(chevron.current, { rotate: open ? 180 : 0, duration: D.xs, ease: E.out });
    },
    { dependencies: [open] },
  );

  return (
    <article className="blocked">
      <div className="blocked__head">
        <div style={{ minWidth: 0 }}>
          <h3 className="t-display-m" style={{ color: "var(--refuse)" }}>
            {props.kind === "breach"
              ? `CovenantBreach("${props.covenant}")`
              : props.covenant}
          </h3>
          <p className="t-data" style={{ marginTop: 16, color: "var(--ink-2)" }}>
            {props.reason}
          </p>
        </div>

        <dl className="blocked__meta t-data-sm">
          <div>
            <dt>WHEN</dt>
            <dd>{props.when}</dd>
          </div>
          <div>
            <dt>{props.kind === "breach" ? "OBSERVED" : "ATTEMPTED"}</dt>
            <dd>{props.action ?? "—"}</dd>
          </div>
          <div>
            <dt>SEQ</dt>
            <dd>
              <a href={props.href} target="_blank" rel="noreferrer" data-cursor="OPEN">
                #{props.seq} ↗
              </a>
            </dd>
          </div>
        </dl>
      </div>

      {props.prompt && (
        <>
          <button
            type="button"
            className="blocked__toggle t-data-sm"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span ref={chevron} aria-hidden="true" style={{ display: "inline-block" }}>
              ▾
            </span>
            {open ? "HIDE" : "SHOW"} THE CONTEXT THE MANAGER SAW
            {props.contextHash && (
              <span style={{ color: "var(--ink-3)" }}>
                {" · "}
                {props.contextHash.slice(0, 10)}…
              </span>
            )}
          </button>

          <div ref={body} style={{ height: 0, opacity: 0, overflow: "hidden" }}>
            <div className="blocked__prompt">
              <p className="t-data-sm" style={{ color: "var(--ink-3)", marginBottom: 12 }}>
                {props.injected
                  ? "POISONED — THE STRING BELOW IS AN INSTRUCTION, NOT A PROPOSAL"
                  : "PROPOSER REASONING"}
              </p>
              <p className="t-data" style={{ color: "var(--ink)", whiteSpace: "pre-wrap" }}>
                {highlight(props.prompt)}
              </p>
            </div>
          </div>
        </>
      )}
    </article>
  );
}
