"use client";

import { useLayoutEffect, useState } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { registerGsap } from "@/components/motion/gsap";

/**
 * Pin a section and turn scroll distance into a step index.
 *
 * Returns `pinned` as well as `step`, and that is the important part: callers
 * must render every step into the DOM regardless, and use `pinned` only to
 * decide emphasis. So with JavaScript off, with reduced motion set, or on a
 * screen too small to pin against, the section is a plain readable list of all
 * its steps rather than a sequence stuck on step one.
 *
 * Pinning is also gated on having room for it. A pinned panel taller than the
 * viewport scrolls its own content out of reach, which is worse than not
 * pinning, so below 768px wide or 640px tall this does nothing at all.
 */
export function usePinnedSteps(
  ref: React.RefObject<HTMLElement | null>,
  count: number,
  /** viewport heights of scroll distance per step */
  perStep = 0.85,
): { step: number; pinned: boolean } {
  const [step, setStep] = useState(0);
  const [pinned, setPinned] = useState(false);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || count < 1) return;

    const g = registerGsap();
    const mm = g.matchMedia();

    mm.add(
      "(prefers-reduced-motion: no-preference) and (min-width: 768px) and (min-height: 640px)",
      () => {
        setPinned(true);
        const trigger = ScrollTrigger.create({
          trigger: root,
          start: "top top",
          end: () => `+=${window.innerHeight * perStep * count}`,
          pin: true,
          pinSpacing: true,
          anticipatePin: 1,
          onUpdate: (self) => {
            // The last step holds for its full share rather than existing for
            // a single pixel at progress 1.
            const i = Math.min(count - 1, Math.floor(self.progress * count));
            setStep(i);
          },
        });

        return () => {
          trigger.kill();
          setPinned(false);
          setStep(0);
        };
      },
    );

    return () => {
      mm.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, perStep]);

  return { step, pinned };
}
