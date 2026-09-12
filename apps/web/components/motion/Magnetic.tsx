"use client";

import { useRef, type ReactNode } from "react";
import { gsap, useGSAP, prefersReducedMotion } from "./gsapPaper";

/**
 * Magnetic pull toward the pointer.
 *
 * Used on the two hero actions and the mark, and nowhere else. On every link it
 * stops being a detail and becomes a tic.
 */
export function Magnetic({
  children,
  strength = 0.35,
  radius = 120,
  className = "",
}: {
  children: ReactNode;
  strength?: number;
  radius?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || prefersReducedMotion()) return;
      if (window.matchMedia("(pointer: coarse)").matches) return;

      // quickTo keeps one tween alive instead of creating one per pointer move.
      const x = gsap.quickTo(el, "x", { duration: 0.4, ease: "power3.out" });
      const y = gsap.quickTo(el, "y", { duration: 0.4, ease: "power3.out" });

      const move = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        if (Math.hypot(dx, dy) > radius) {
          x(0);
          y(0);
          return;
        }
        x(dx * strength);
        y(dy * strength);
      };

      // The release is the part that reads as magnetism: it overshoots home.
      const leave = () => {
        gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1,0.4)" });
      };

      window.addEventListener("pointermove", move);
      el.addEventListener("pointerleave", leave);
      return () => {
        window.removeEventListener("pointermove", move);
        el.removeEventListener("pointerleave", leave);
      };
    },
    { scope: ref },
  );

  return (
    <span ref={ref} className={`inline-block ${className}`}>
      {children}
    </span>
  );
}
