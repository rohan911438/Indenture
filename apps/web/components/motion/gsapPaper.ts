"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";

/**
 * Registration for the paper system.
 *
 * Every plugin is free for commercial use as of April 2025, so there is no
 * licence gate here. useGSAP is re-exported from one place so no island has to
 * remember to register before it animates.
 */
let registered = false;

export function registerPaperGsap() {
  if (!registered && typeof window !== "undefined") {
    gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);
    registered = true;
  }
  return gsap;
}

export { gsap, ScrollTrigger, SplitText, useGSAP };

/** True when the reader has asked for less motion. Timelines are not built at
 *  all in that case — a shortened animation is still an animation. */
export function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
