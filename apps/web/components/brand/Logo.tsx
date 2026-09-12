import Image from "next/image";
import { Mark, type MarkState } from "./Mark";

/**
 * The lockups.
 *
 * The horizontal lockup is the supplied artwork whole, rather than a mark and a
 * wordmark re-spaced by hand — the delivered file already carries its own
 * optical alignment and gap, and rebuilding those would be changing the logo.
 *
 * The stacked lockup is the only one that needs the pieces apart, because the
 * mark has to be able to animate under a wordmark that does not. Its wordmark
 * is cut from the same file, so the two lockups are the same artwork.
 */
export function Logo({
  variant = "horizontal",
  size = 24,
  state = "sealed",
  className = "",
}: {
  variant?: "horizontal" | "stacked" | "mark";
  /** mark height in px; the lockups scale from it */
  size?: number;
  state?: MarkState;
  className?: string;
}) {
  if (variant === "mark") {
    return <Mark state={state} size={size} className={className} />;
  }

  if (variant === "stacked") {
    return (
      <span
        className={`inline-flex flex-col items-center ${className}`}
        style={{ gap: Math.round(size * 0.31) }}
      >
        <Mark state={state} size={size} />
        <Image
          src="/brand/wordmark.png"
          alt="Indenture"
          width={900}
          height={402}
          priority
          className="lockup-img"
          style={{ width: Math.round(size * 2.4), height: "auto" }}
        />
      </span>
    );
  }

  // Horizontal. Width is derived from the mark height so callers size one thing.
  return (
    <Image
      src="/brand/lockup.png"
      alt="Indenture"
      width={1200}
      height={405}
      priority
      className={`lockup-img ${className}`}
      style={{ height: Math.round(size * 1.18), width: "auto" }}
    />
  );
}
