"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger, registerPaperGsap, prefersReducedMotion } from "./gsapPaper";

/**
 * Smooth scroll, driven by GSAP's ticker rather than its own rAF loop.
 *
 * Two loops means two clocks, and ScrollTrigger measuring against a position
 * Lenis has already moved past. One ticker, lag smoothing off, and
 * ScrollTrigger.update on every Lenis scroll keeps pins honest.
 *
 * Under reduced motion Lenis is never constructed at all — native scrolling is
 * the correct behaviour, not a degraded one.
 */
export function SmoothScroll() {
  useEffect(() => {
    registerPaperGsap();
    if (prefersReducedMotion()) {
      gsap.globalTimeline.timeScale(100);
      return;
    }

    const lenis = new Lenis({ lerp: 0.09 });
    const raf = (time: number) => lenis.raf(time * 1000);

    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    /**
     * Masks are measured against line boxes, and line boxes move when the real
     * face replaces the fallback. Refreshing after the fonts land is the
     * difference between a clean mask and a reveal that clips its own descenders.
     */
    document.fonts?.ready.then(() => ScrollTrigger.refresh());

    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, []);

  return null;
}
