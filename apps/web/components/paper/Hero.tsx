"use client";

import { useRef } from "react";
import { gsap, useGSAP, prefersReducedMotion } from "@/components/motion/gsapPaper";
import { Reveal } from "@/components/motion/Reveal";
import { Rise } from "@/components/motion/Rise";
import { Magnetic } from "@/components/motion/Magnetic";
import { Mark } from "@/components/brand/Mark";
import { Eyebrow } from "./Primitives";
import { HeroActions } from "./HeroActions";

export type HeroFact = { label: string; value: string };

/**
 * The hero.
 *
 * One composition rather than a stack of parts. The image is the ground the
 * band is built on, the headline runs the full width of the page, and the
 * content sits low — the arrangement a poster uses, and the one kimia uses:
 * the picture carries the space and the type carries the claim.
 *
 * What this replaces was a four-word headline at 104px in the top-left eighth
 * of a viewport-tall black rectangle. Type that small in a space that large
 * reads as a placeholder no matter what is put beside it, so the fix was not
 * another column of content — it was to let the words be the layout.
 *
 * Near-black, Medium weight, and exactly one saturated colour, on the one word
 * that earns it.
 */
export function Hero({
  facts,
  banner,
  builtOn,
}: {
  facts: HeroFact[];
  /** the ground photograph, or null until one is dropped into public/ */
  banner: string | null;
  builtOn: string[];
}) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const el = root.current;
      if (!el) return;

      const placeholder = el.querySelector(
        ".hero__bg[data-placeholder='true'] .mark",
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

      // With a photograph in place the ground drifts under the type as the
      // page moves, which reads as depth rather than as an animation.
      const img = el.querySelector(".hero__bg img");
      if (!img) return;
      const drift = gsap.fromTo(
        img,
        { scale: 1.12, yPercent: -3 },
        {
          scale: 1,
          yPercent: 3,
          ease: "none",
          scrollTrigger: { trigger: el, start: "top top", end: "bottom top", scrub: 1 },
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
      <div className="hero__bg" data-placeholder={banner ? undefined : "true"} aria-hidden="true">
        {banner ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={banner} alt="" fetchPriority="high" />
        ) : (
          <Mark size={420} />
        )}
      </div>

      <div className="shell">
        <Rise start="top 95%">
          <Eyebrow>A Uniswap v4 hook on Hedera</Eyebrow>
        </Rise>

        <div className="hero__lower" style={{ marginTop: 28 }}>
          <Reveal
            as="h1"
            className="hero__headline"
            id="hero-head"
            start="top 95%"
            delay={0.05}
          >
            The pool that
            <br />
            says <span style={{ color: "var(--refuse)" }}>no.</span>
          </Reveal>

          {/* Bottom-aligned with the headline's last line, so the two halves
              share a baseline instead of drifting apart down the page. */}
          <Rise className="hero__aside" start="top 95%" delay={0.25}>
            <p className="t-prose" style={{ color: "var(--on-dark-2)", maxWidth: "44ch" }}>
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

        <div className="hero__foot">
          <Rise as="dl" className="hero__rail" start="top 99%" stagger={0.05}>
            {facts.map((f) => (
              <div key={f.label} className="hero__fact">
                <dt className="t-eyebrow">{f.label}</dt>
                <dd className="t-data">{f.value}</dd>
              </div>
            ))}
            <div className="hero__fact">
              {/* Demoted from a column of 28px names to one more fact on the
                  rail. It is provenance, not a headline. */}
              <dt className="t-eyebrow">Built on</dt>
              <dd className="t-data">{builtOn.join(" · ")}</dd>
            </div>
          </Rise>

          {/* Outside the list: a dl may only hold dt/dd groups, and this is an
              instruction rather than a fact about the deployment. */}
          <div className="hero__scroll t-data-sm">
            <span>SCROLL</span>
            <span aria-hidden="true">↓</span>
          </div>
        </div>
      </div>
    </section>
  );
}
