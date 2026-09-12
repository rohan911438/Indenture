"use client";

import { useRef } from "react";
import { gsap, useGSAP, prefersReducedMotion } from "@/components/motion/gsapPaper";
import { Reveal } from "@/components/motion/Reveal";
import { Rise } from "@/components/motion/Rise";
import { Magnetic } from "@/components/motion/Magnetic";
import { Mark } from "@/components/brand/Mark";
import { Eyebrow } from "./Primitives";
import { HeroActions } from "./HeroActions";

const BUILT_ON = ["Hedera", "Uniswap v4", "Chainlink"];

export type HeroFact = { label: string; value: string };

/**
 * The hero — the one monumental, two-colour moment on the site.
 *
 * Arranged the way kimia arranges its own: a headline block, a full-bleed
 * banner, then the facts that back the claim. The banner is doing real work.
 * Before it, the band was a four-word headline in the top-left corner of a
 * viewport-tall black rectangle, and no amount of type scale fixes that — a
 * short headline needs something beside it.
 *
 * Near-black, Medium display weight, and exactly one saturated colour, on the
 * one word that earns it. Everything below this band is paper, and the change
 * is a hard edge: the band simply ends.
 */
export function Hero({
  facts,
  banner,
}: {
  facts: HeroFact[];
  /** the banner photograph, or null until one is dropped into public/ */
  banner: string | null;
}) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const el = root.current;
      if (!el) return;

      const placeholder = el.querySelector(
        ".hero__banner[data-placeholder='true'] .mark",
      );
      if (placeholder) {
        // 0.4°/s — slow enough to be a thing you notice only on the second look.
        const spin = gsap.to(placeholder, {
          rotation: 360,
          duration: 900,
          ease: "none",
          repeat: -1,
        });
        return () => spin.kill();
      }

      // With a photograph in place the band drifts against the scroll instead,
      // which reads as depth rather than as an animation.
      const img = el.querySelector(".hero__banner img");
      if (!img) return;
      const drift = gsap.fromTo(
        img,
        { scale: 1.08, yPercent: -2 },
        {
          scale: 1,
          yPercent: 2,
          ease: "none",
          scrollTrigger: {
            trigger: el.querySelector(".hero__banner"),
            start: "top bottom",
            end: "bottom top",
            scrub: 1,
          },
        },
      );
      return () => {
        drift.scrollTrigger?.kill();
        drift.kill();
      };
    },
    { scope: root },
  );

  return (
    <section ref={root} className="hero on-obsidian" aria-labelledby="hero-head">
      <div className="shell">
        <div className="hero__grid">
          <div>
            <Eyebrow>A Uniswap v4 hook on Hedera</Eyebrow>

            <Reveal
              as="h1"
              className="t-display-xl"
              id="hero-head"
              start="top 95%"
              delay={0.05}
            >
              The pool
              <br />
              that says
              <br />
              <span style={{ color: "var(--refuse)" }}>no.</span>
            </Reveal>

            <Rise className="mt-10 flex flex-col gap-10" start="top 95%" delay={0.25}>
              <p
                className="t-prose"
                style={{ color: "var(--on-dark-2)", maxWidth: "52ch" }}
              >
                A Uniswap v4 hook that refuses two things a pool has never been
                able to refuse: a buyer who isn&rsquo;t qualified, and a manager
                exceeding his mandate.
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <Magnetic>
                  <a className="btn btn--primary" href="#terminal" data-cursor="SEND">
                    Try the attack
                  </a>
                </Magnetic>
                <HeroActions />
              </div>
            </Rise>
          </div>

          {/* Bottom-aligned with the actions, so the two columns share a
              baseline instead of starting level and drifting apart. */}
          <Rise className="hero__built" start="top 95%" delay={0.4}>
            <Eyebrow>Built on</Eyebrow>
            {BUILT_ON.map((name) => (
              <p key={name}>{name}</p>
            ))}
          </Rise>
        </div>
      </div>

      <div className="hero__banner" data-placeholder={banner ? undefined : "true"}>
        {banner ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={banner}
            alt=""
            /* Decorative: everything it says is said in words above it. */
            aria-hidden="true"
            fetchPriority="high"
          />
        ) : (
          <Mark size={200} />
        )}
      </div>

      <div className="shell hero__foot">
        <Rise as="dl" className="hero__rail" start="top 98%" stagger={0.05}>
          {facts.map((f) => (
            <div key={f.label} className="hero__fact">
              <dt className="t-eyebrow">{f.label}</dt>
              <dd className="t-data">{f.value}</dd>
            </div>
          ))}
        </Rise>
        {/* Outside the list: a dl may only hold dt/dd groups, and this is an
            instruction rather than a fact about the deployment. */}
        <div className="hero__scroll t-data-sm">
          <span>SCROLL</span>
          <span aria-hidden="true">↓</span>
        </div>
      </div>
    </section>
  );
}
