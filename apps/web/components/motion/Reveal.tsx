"use client";

import { useRef, type ElementType, type ReactNode } from "react";
import { gsap, SplitText, useGSAP, registerPaperGsap } from "./gsapPaper";
import { D, E, STAGGER } from "@/lib/motion";

/**
 * The masked per-line reveal — the default entrance for every heading and every
 * prose block on the site, and deliberately the ONLY entrance they get. A
 * heading that masks and fades and slides reads as a template; masking alone
 * reads as typography.
 *
 * The element is hidden before first paint by `.choreographed [data-reveal]`,
 * which a blocking script sets only when the reader has not asked for less
 * motion. So with JS off, or under `reduce`, this renders as plain visible text
 * and nothing here runs.
 */
export function Reveal({
  as: Tag = "div",
  children,
  className = "",
  start = "top 82%",
  duration = D.md,
  stagger = STAGGER.line,
  delay = 0,
  id,
}: {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  start?: string;
  duration?: number;
  stagger?: number;
  delay?: number;
  id?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      registerPaperGsap();

      const split = new SplitText(el, { type: "lines", linesClass: "line" });

      // SplitText gives us the lines; the mask is a wrapper we add around each,
      // because overflow on the line itself would clip the very thing moving.
      for (const line of split.lines) {
        const mask = document.createElement("div");
        mask.className = "line-mask";
        line.parentNode?.insertBefore(mask, line);
        mask.appendChild(line);
      }

      // The handover: CSS hid the element, GSAP shows it, and the masks hide the
      // lines instead. There is never a frame where unanimated text is visible.
      gsap.set(el, { opacity: 1 });

      const tween = gsap.from(split.lines, {
        yPercent: 110,
        duration,
        ease: E.big,
        stagger,
        delay,
        scrollTrigger: { trigger: el, start, once: true },
      });

      return () => {
        tween.scrollTrigger?.kill();
        tween.kill();
        split.revert();
      };
    },
    { scope: ref },
  );

  return (
    <Tag ref={ref} id={id} data-reveal className={className}>
      {children}
    </Tag>
  );
}
