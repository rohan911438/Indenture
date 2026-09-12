"use client";

import { useRef } from "react";
import { gsap, useGSAP, registerPaperGsap, prefersReducedMotion } from "./gsapPaper";
import { D, E } from "@/lib/motion";

/**
 * A figure that counts up when it arrives.
 *
 * The shape of the number is declared rather than passed as a formatter,
 * because these are used from server components and a function cannot cross
 * that boundary. Counting happens in whole units — `value` is the figure in its
 * smallest unit and `divisor` puts the point back — so the digits never show a
 * fractional frame on the way up.
 *
 * The server renders the final value, so the number is correct with JS off and
 * a screen reader never hears it tick. The tween only ever overwrites it on the
 * way to the same place.
 */
export function Counter({
  value,
  divisor = 1,
  decimals = 0,
  prefix = "",
  suffix = "",
  className = "",
  start = "top 80%",
  duration = D.lg,
}: {
  /** the figure in whole units, before `divisor` is applied */
  value: number;
  divisor?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  start?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  const print = (n: number) =>
    prefix + (n / divisor).toFixed(decimals) + suffix;

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      registerPaperGsap();

      /**
       * Behind the seal gate the page renders inert and blurred. A counter that
       * runs there spends its whole animation unreadable and leaves a 0 on
       * screen under the blur, which reads as the fund having refused nothing.
       * Inert content keeps the server-rendered figure instead.
       */
      if (el.closest("[inert]") || prefersReducedMotion()) return;

      const counter = { n: 0 };
      const tween = gsap.to(counter, {
        n: value,
        duration,
        ease: E.out,
        snap: { n: 1 },
        onUpdate: () => {
          el.textContent = print(counter.n);
        },
        scrollTrigger: { trigger: el, start, once: true },
      });

      return () => {
        tween.scrollTrigger?.kill();
        tween.kill();
        el.textContent = print(value);
      };
    },
    { scope: ref },
  );

  return (
    <span ref={ref} className={className}>
      {print(value)}
    </span>
  );
}
