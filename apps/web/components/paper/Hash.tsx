"use client";

import { useState } from "react";

/**
 * An address or hash: truncated, and copyable in one click.
 *
 * The flash is the whole acknowledgement — no toast, no icon swap. It is the
 * one place --permit appears without anything having been permitted, and it
 * lasts 600ms.
 */
export function Hash({ value, chars = 6 }: { value: string; chars?: number }) {
  const [copied, setCopied] = useState(false);

  const short =
    value.length > chars * 2 + 3
      ? `${value.slice(0, chars)}…${value.slice(-4)}`
      : value;

  return (
    <button
      type="button"
      data-cursor="COPY"
      title={value}
      onClick={() => {
        navigator.clipboard?.writeText(value).then(
          () => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 600);
          },
          () => {},
        );
      }}
      className="t-data"
      style={{
        color: copied ? "var(--permit)" : "var(--ink-2)",
        background: "none",
        border: 0,
        padding: 0,
        cursor: "pointer",
        transition: "color 240ms cubic-bezier(0.16,0.84,0.28,1)",
      }}
    >
      {short}
    </button>
  );
}
