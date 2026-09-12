"use client";

import { useRef, useState } from "react";
import gsap from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { ScrollTrigger, useGSAP, registerPaperGsap, prefersReducedMotion } from "@/components/motion/gsapPaper";
import { Reveal } from "@/components/motion/Reveal";
import { Eyebrow, Rule } from "./Primitives";

const STAGES = [
  {
    title: "Propose",
    body: "The manager reads whatever it has been given and proposes a trade. It is assumed compromised, so nothing about this step is trusted — including its reasoning.",
  },
  {
    title: "Validate",
    body: "An independent validator re-derives the decision from structured inputs it fetches itself. It never reads the prompt, the reasoning, or any text the manager saw.",
  },
  {
    title: "Sign",
    body: "If the decision survives, the validator signs an EIP-712 receipt over the pool and the parameters. If it does not, there is no signature and nothing to present.",
  },
  {
    title: "Enforce",
    body: "The hook verifies that signature inside beforeSwap and evaluates the covenants itself. Anything outside the mandate reverts with a named reason.",
  },
  {
    title: "Journal",
    body: "The outcome is written to Hedera consensus — approvals, refusals and breaches alike — before it is anyone's word against anyone else's.",
  },
];

/**
 * Five stages, advanced by the scroll.
 *
 * The section pins for 300vh and snaps between stages, so the reader moves
 * through the pipeline a step at a time rather than skimming five paragraphs.
 * The connector draws as they advance, which is the only thing on the page that
 * tracks scroll position continuously.
 *
 * Below 1024px there is no pin at all. A pinned section on a phone is a section
 * someone has to fight to get past.
 */
export function Mechanism() {
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useGSAP(
    () => {
      const el = root.current;
      if (!el || prefersReducedMotion()) return;
      registerPaperGsap();
      gsap.registerPlugin(DrawSVGPlugin);

      const mm = gsap.matchMedia();

      mm.add("(min-width: 1024px)", () => {
        const line = el.querySelector<SVGLineElement>("[data-connector]");

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: el,
            start: "top top",
            end: "+=300%",
            pin: true,
            scrub: 1,
            snap: 1 / (STAGES.length - 1),
            onUpdate: (self) => {
              // Round rather than floor: the snap lands on a stage, and the
              // label should change when it arrives, not a quarter early.
              setActive(Math.round(self.progress * (STAGES.length - 1)));
            },
          },
        });

        if (line) {
          tl.fromTo(line, { drawSVG: "0%" }, { drawSVG: "100%", ease: "none" }, 0);
        }

        return () => {
          tl.scrollTrigger?.kill();
          tl.kill();
        };
      });

      // The pin changes the document height, so everything below it measured
      // against the wrong page until this ran.
      ScrollTrigger.refresh();

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <>
      <Rule />
      <section className="section" aria-labelledby="mech-head">
        <div ref={root} className="shell mech">
          <Eyebrow className="section__eyebrow">How</Eyebrow>

          <Reveal as="h2" id="mech-head" className="t-display-l section__head" start="top 85%">
            Five steps, and the manager is trusted at none of them.
          </Reveal>

          <div className="mech__rail">
            <svg
              className="mech__line"
              viewBox="0 0 100 2"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <line x1="0" y1="1" x2="100" y2="1" stroke="var(--rule)" strokeWidth="2" />
              <line
                data-connector
                x1="0"
                y1="1"
                x2="100"
                y2="1"
                stroke="var(--ink)"
                strokeWidth="2"
              />
            </svg>

            <ol className="mech__stages">
              {STAGES.map((s, i) => (
                <li
                  key={s.title}
                  className="mech__stage"
                  data-active={i <= active}
                  style={{ listStyle: "none" }}
                >
                  <div className="mech__node">{i + 1}</div>
                  <h3 className="mech__title t-title">{s.title}</h3>
                  <p className="mech__body t-small">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </>
  );
}
