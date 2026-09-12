"use client";

import { forwardRef } from "react";
import { Mark } from "./Mark";

/**
 * The refusal stamp — the mark in its `refused` state, halves out of register,
 * struck across whatever was just refused.
 *
 * It holds no timeline of its own. useStamp() in lib/motion drives it, because
 * the stamp has to land on the exact frame the covenant check fails.
 */
export const Stamp = forwardRef<HTMLDivElement, { size?: number; className?: string }>(
  function Stamp({ size = 120, className = "" }, ref) {
    return (
      <div ref={ref} className={`stamp ${className}`} style={{ rotate: "-6deg" }}>
        <Mark state="refused" size={size} />
      </div>
    );
  },
);
