"use client";

import { useEffect, useRef, useState } from "react";
import { gsap, useGSAP, prefersReducedMotion } from "./gsapPaper";

/**
 * The custom cursor: an 8px dot that tracks the pointer exactly, and a 36px
 * ring on a slower lerp so it lags behind and catches up.
 *
 * Anything carrying data-cursor="…" grows the ring to 64px and prints that word
 * inside it, which is how a control says what it does before you click it.
 *
 * Both invert over an obsidian band, because a dark cursor on a near-black hero
 * is no cursor at all. The band under the pointer is found by hit-testing for
 * an .on-obsidian ancestor rather than by hard-coding section bounds, so it
 * stays right when sections move.
 */
export function Cursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const [fine, setFine] = useState(false);

  /**
   * Nothing is rendered at all on a touch device. Hiding these in CSS still
   * left two fixed nodes parked at the origin, and a page must not carry
   * elements whose only job is to be invisible.
   */
  useEffect(() => {
    setFine(
      window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
        !prefersReducedMotion(),
    );
  }, []);

  useGSAP(() => {
    const d = dot.current;
    const r = ring.current;
    if (!d || !r || !fine) return;

    const dx = gsap.quickTo(d, "x", { duration: 0.12, ease: "power3.out" });
    const dy = gsap.quickTo(d, "y", { duration: 0.12, ease: "power3.out" });
    const rx = gsap.quickTo(r, "x", { duration: 0.42, ease: "power3.out" });
    const ry = gsap.quickTo(r, "y", { duration: 0.42, ease: "power3.out" });

    let label = "";
    let inverted = false;

    const move = (e: PointerEvent) => {
      dx(e.clientX);
      dy(e.clientY);
      rx(e.clientX);
      ry(e.clientY);

      const el = document.elementFromPoint(e.clientX, e.clientY);

      const next = el?.closest<HTMLElement>("[data-cursor]")?.dataset.cursor ?? "";
      if (next !== label) {
        label = next;
        r.textContent = label;
        gsap.to(r, {
          width: label ? 64 : 36,
          height: label ? 64 : 36,
          margin: label ? "-32px 0 0 -32px" : "-18px 0 0 -18px",
          duration: 0.24,
          ease: "power3.out",
        });
        gsap.to(d, { opacity: label ? 0 : 1, duration: 0.24 });
      }

      const dark = !!el?.closest(".on-obsidian");
      if (dark !== inverted) {
        inverted = dark;
        d.dataset.invert = String(dark);
        r.dataset.invert = String(dark);
      }
    };

    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [fine]);

  if (!fine) return null;

  return (
    <>
      <div ref={dot} className="cursor-dot" aria-hidden="true" />
      <div ref={ring} className="cursor-ring" aria-hidden="true" />
    </>
  );
}
