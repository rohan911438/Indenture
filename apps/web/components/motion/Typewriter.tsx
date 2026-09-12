"use client";

import { useRef } from "react";
import { gsap, useGSAP, prefersReducedMotion } from "./gsapPaper";

/**
 * Types a string on, one character at a time, when it scrolls into view.
 *
 * The full string is in the DOM from the server, so it is readable with JS off
 * and a screen reader never hears it letter by letter. The tween only hides it
 * and puts it back.
 */
export function Typewriter({
  text,
  className = "",
  style,
  msPerChar = 18,
  delay = 0,
  start = "top 80%",
}: {
  text: string;
  className?: string;
  style?: React.CSSProperties;
  msPerChar?: number;
  delay?: number;
  start?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || prefersReducedMotion()) return;

      const state = { i: 0 };
      const tween = gsap.to(state, {
        i: text.length,
        duration: (text.length * msPerChar) / 1000,
        ease: "none",
        delay,
        snap: { i: 1 },
        onUpdate: () => {
          el.textContent = text.slice(0, Math.round(state.i));
        },
        scrollTrigger: { trigger: el, start, once: true },
        onStart: () => {
          el.textContent = "";
        },
      });

      return () => {
        tween.scrollTrigger?.kill();
        tween.kill();
        el.textContent = text;
      };
    },
    { scope: ref, dependencies: [text] },
  );

  return (
    <span ref={ref} className={className} style={style}>
      {text}
    </span>
  );
}
