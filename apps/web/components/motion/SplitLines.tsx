"use client";

import { useRef } from "react";
import { useChoreography } from "@/components/motion/gsap";

/**
 * Sets a block of text line by line, the way a compositor would — each line
 * rising into place out of a mask.
 *
 * SplitText measures lines after the browser has wrapped them, so the effect
 * survives any reflow, font size or line count, and `autoSplit` re-runs it when
 * the web font lands. The DOM keeps the real text: SplitText wraps it in spans
 * rather than retyping it, so it stays selectable, and `aria` defaults to
 * labelling the block so a screen reader reads one sentence, not one line at a
 * time.
 *
 * The root carries data-reveal, so it is already hidden before first paint and
 * there is no frame where the unanimated text is visible.
 */
export function SplitLines({
  children,
  className = "",
  delay = 0,
  stagger = 0.09,
  as: As = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  stagger?: number;
  as?: "div" | "h1" | "h2" | "p";
}) {
  const ref = useRef<HTMLElement>(null);

  useChoreography(ref, ({ gsap, SplitText, root }) => {
    gsap.set(root, { opacity: 1 });
    SplitText.create(root, {
      type: "lines",
      mask: "lines",
      autoSplit: true,
      // Returning the tween lets GSAP re-run it cleanly when the font loads
      // or the text rewraps.
      onSplit: (self) =>
        gsap.from(self.lines, {
          yPercent: 110,
          duration: 1.05,
          ease: "power3.out",
          stagger,
          delay,
        }),
    });
  });

  return (
    <As
      ref={ref as React.Ref<HTMLHeadingElement & HTMLParagraphElement & HTMLDivElement>}
      className={className}
      data-reveal
    >
      {children}
    </As>
  );
}
