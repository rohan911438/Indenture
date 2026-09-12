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
 * Near-black, Medium display weight, and exactly one saturated colour, on the
 * one word that earns it. Everything below this band is paper, and the change
 * is a hard edge: the band simply ends. A gradient between them would turn two
 * deliberate surfaces into one indecisive one.
 *
 * The band closes on a rail of instrument facts. Without it the lower half of
 * 88vh was empty, and the claim at the top was asking to be taken on trust
 * while the addresses that back it sat three sections further down.
 */
export function Hero({ facts }: { facts: HeroFact[] }) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const mark = root.current?.querySelector(".hero__mark .mark");
      if (!mark) return;
      // 0.4°/s. Slow enough to be a thing you notice only on the second look.
      const spin = gsap.to(mark, {
        rotation: 360,
        duration: 900,
        ease: "none",
        repeat: -1,
      });
      return () => spin.kill();
    },
    { scope: root },
  );

  return (
    <section ref={root} className="hero on-obsidian" aria-labelledby="hero-head">
      <div className="hero__mark" aria-hidden="true">
        <Mark size={240} />
      </div>

      <div className="shell">
        <div className="hero__grid">
          <div>
            <Reveal as="h1" className="t-display-xl" id="hero-head" start="top 95%">
              The pool
              <br />
              that says
              <br />
              <span style={{ color: "var(--refuse)" }}>no.</span>
            </Reveal>

            <Rise className="mt-10 flex flex-col gap-12" start="top 95%" delay={0.25}>
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

          {/* Aligned to the headline's first baseline, not to the top of its box. */}
          <Rise className="flex flex-col gap-6 lg:pt-6" start="top 95%" delay={0.4}>
            <Eyebrow>Built on</Eyebrow>
            {BUILT_ON.map((name) => (
              <p
                key={name}
                style={{
                  fontSize: 28,
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                  color: "var(--on-dark-2)",
                }}
              >
                {name}
              </p>
            ))}
          </Rise>
        </div>
      </div>

      <div className="shell">
        <Rise as="dl" className="hero__rail" start="top 98%" stagger={0.05}>
          {facts.map((f) => (
            <div key={f.label} className="hero__fact">
              <dt className="t-eyebrow">{f.label}</dt>
              <dd className="t-data">{f.value}</dd>
            </div>
          ))}
          <div className="hero__scroll t-data-sm">
            <span>SCROLL</span>
            <span aria-hidden="true">↓</span>
          </div>
        </Rise>
      </div>
    </section>
  );
}
