"use client";

import type gsap from "gsap";
import { D, E } from "@/lib/motion";

/**
 * The refusal, appended to whatever timeline is running.
 *
 * It is the one thing on the site allowed to be abrupt. Everything else eases
 * out over half a second or more; this arrives at 2.4× scale and lands in
 * 400ms, and that contrast is what makes it read as a judgement rather than a
 * transition.
 *
 * Under a second, start to finish, and it takes itself away.
 */
export function stampInto(
  tl: gsap.core.Timeline,
  parts: { mark: Element | null; row?: Element | null; panel?: Element | null },
  at?: string | number,
) {
  const { mark, row, panel } = parts;
  if (!mark) return tl;

  tl.fromTo(
    mark,
    { scale: 2.4, opacity: 0, rotate: -14 },
    { scale: 1, opacity: 1, rotate: -6, duration: D.sm, ease: E.snap },
    at,
  );

  if (row) tl.to(row, { borderColor: "var(--refuse)", duration: D.xs }, "<");
  if (panel) tl.to(panel, { x: -2, duration: 0.04, yoyo: true, repeat: 3 }, "<");

  tl.to(mark, { opacity: 0, duration: D.sm }, "+=0.6");
  return tl;
}
