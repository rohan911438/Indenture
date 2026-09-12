"use client";

import { useRef } from "react";
import { gsap, useGSAP, prefersReducedMotion } from "@/components/motion/gsapPaper";
import { Reveal } from "@/components/motion/Reveal";
import { Rise } from "@/components/motion/Rise";
import { Magnetic } from "@/components/motion/Magnetic";
import { Mark } from "@/components/brand/Mark";
import { Eyebrow } from "./Primitives";
import { HeroActions } from "./HeroActions";

/**
 * The hero.
 *
 * One composition. The image is the ground the band is built on, the headline
 * runs the full width of the page, and the content sits low — the arrangement
 * a poster uses: the picture carries the space and the type carries the claim.
 *
 * It holds nothing else. A marquee ran above it and a rail of addresses below
 * it, and both were strips of 11px type bracketing a headline that is supposed
 * to be the only thing on the screen. What they carried has a better home: the
 * refusal count is the header of /blocked, and the contract and topic ids are
 * in the stack section as links someone can actually follow.
 *
 * Near-black, Medium weight, and exactly one saturated colour, on the one word
 * that earns it.
 */
export function Hero({
  banner,
}: {
  /** the ground photograph, or null until one is dropped into public/ */
  banner: string | null;
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
      <div
        className="hero__bg"
        data-placeholder={banner ? undefined : "true"}
        aria-hidden="true"
      >
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
      </div>

      <div className="hero__scroll t-data-sm">
        <span>SCROLL</span>
        <span aria-hidden="true">↓</span>
      </div>
    </section>
  );
}
