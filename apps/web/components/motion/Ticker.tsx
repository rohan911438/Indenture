"use client";

import { useRef, type ReactNode } from "react";
import { gsap, useGSAP, prefersReducedMotion } from "./gsapPaper";

/**
 * The marquee.
 *
 * The content is rendered twice and the track translated by exactly -50%, so
 * the second run is in position the instant the first leaves — the seam is the
 * point. A CSS marquee cannot do this without hard-coding a width, and a
 * marquee whose content does not actually repeat is the tell.
 *
 * One duplicate is aria-hidden so a screen reader reads the line once.
 */
export function Ticker({
  children,
  seconds = 28,
  className = "",
}: {
  children: ReactNode;
  seconds?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const track = ref.current?.querySelector<HTMLElement>(".ticker__track");
      if (!track) return;

      const tween = gsap.to(track, {
        xPercent: -50,
        duration: seconds,
        ease: "none",
        repeat: -1,
      });
      return () => tween.kill();
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={`ticker ${className}`}>
      <div className="ticker__track">
        <div className="ticker__run">{children}</div>
        <div className="ticker__run" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}
