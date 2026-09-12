"use client";

import { useRef, type ElementType, type ReactNode } from "react";
import { gsap, useGSAP, registerPaperGsap } from "./gsapPaper";
import { D, E, STAGGER } from "@/lib/motion";

/**
 * The second, quieter entrance: direct children lift and fade in.
 *
 * Used for rows, cells and controls — things that are a list rather than a
 * sentence. Headings and prose use Reveal instead, because masking is the
 * stronger idea and a section only gets one.
 */
export function Rise({
  as: Tag = "div",
  children,
  className = "",
  start = "top 82%",
  stagger = STAGGER.card,
  delay = 0,
  distance = 16,
}: {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  start?: string;
  stagger?: number;
  delay?: number;
  distance?: number;
}) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      registerPaperGsap();
      const kids = Array.from(el.children);
      if (!kids.length) return;

      gsap.set(el, { opacity: 1 });
      const tween = gsap.from(kids, {
        y: distance,
        opacity: 0,
        duration: D.sm,
        ease: E.out,
        stagger,
        delay,
        scrollTrigger: { trigger: el, start, once: true },
      });

      return () => {
        tween.scrollTrigger?.kill();
        tween.kill();
      };
    },
    { scope: ref },
  );

  return (
    <Tag ref={ref} data-reveal className={className}>
      {children}
    </Tag>
  );
}
