"use client";

import { useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

/**
 * GSAP registration and the one rule every timeline on this site obeys.
 *
 * All plugins are free for commercial use as of April 2025, so ScrollTrigger
 * and SplitText need no licence gate here.
 *
 * Every timeline is built inside gsap.matchMedia() under
 * (prefers-reduced-motion: no-preference). That is deliberately not the same as
 * a shorter animation: under `reduce` the build function never runs, nothing is
 * hidden, nothing is pinned, and the page is the plain document it already is.
 */
let registered = false;

export function registerGsap() {
  if (!registered) {
    gsap.registerPlugin(ScrollTrigger, SplitText);
    registered = true;
  }
  return gsap;
}

export type Choreography = (ctx: {
  gsap: typeof gsap;
  ScrollTrigger: typeof ScrollTrigger;
  SplitText: typeof SplitText;
  /** scope every selector to the island's own root */
  q: <T extends Element = HTMLElement>(selector: string) => T[];
  root: HTMLElement;
}) => void;

/**
 * Build one island's timelines. `ref` scopes every selector, so two islands can
 * both animate `[data-reveal]` without reaching into each other.
 */
export function useChoreography(
  ref: React.RefObject<HTMLElement | null>,
  build: Choreography,
) {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;

    const g = registerGsap();
    const mm = g.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = <T extends Element = HTMLElement>(selector: string): T[] =>
        Array.from(root.querySelectorAll<T>(selector));

      // Take ownership of the hidden state: the CSS class hid these before
      // first paint, GSAP holds them now. Handing over in this order means
      // there is never a frame where they are visible and unanimated.
      // querySelectorAll never matches the root itself, and an island whose
      // whole body is the reveal (SplitLines) marks the root.
      const hidden = q("[data-reveal]");
      if (root.matches("[data-reveal]")) hidden.unshift(root);

      /**
       * Note what is deliberately NOT here: a `gsap.set(hidden, {opacity: 0})`.
       *
       * Holding the hidden state in a separate `set` meant anything that re-ran
       * this callback could re-hide elements whose reveal had already finished,
       * stranding them invisible — which is exactly what happened in about a
       * third of loads. Islands use `gsap.from()` instead, so one tween owns
       * both ends of the reveal: if it re-runs it simply plays again, and if it
       * is reverted the element falls back to its natural, visible CSS state.
       * The failure direction is "visible but unanimated", never "invisible".
       */
      try {
        build({ gsap: g, ScrollTrigger, SplitText, q, root });
      } catch {
        // A timeline that could not be built must never cost the reader the
        // content it was going to reveal.
        g.set(hidden, { clearProps: "all" });
      }

      /**
       * The last line of defence. Hiding has moved from the stylesheet onto
       * inline styles that GSAP owns, so the ChoreographyFlag's class-removal
       * timer can no longer rescue an element on its own. If anything is still
       * invisible well after every timeline should have finished, show it.
       */
      const failsafe = window.setTimeout(() => {
        for (const el of hidden) {
          if (getComputedStyle(el).opacity === "0") {
            g.set(el, { clearProps: "all" });
          }
        }
      }, 4000);

      return () => {
        window.clearTimeout(failsafe);
        g.set(hidden, { clearProps: "all" });
      };
    });

    // Whether or not the timelines were built, the page must not stay hidden.
    document.documentElement.classList.remove("choreographed");

    return () => {
      mm.revert();
    };
    // The build closure is stable per island; islands re-register on remount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
