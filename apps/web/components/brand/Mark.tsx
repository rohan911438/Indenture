/**
 * The mark.
 *
 * The supplied artwork is used exactly as delivered — not recoloured, not
 * redrawn, not filled. It is painted twice and each copy clipped to one side of
 * the seam (measured at 55.1% of the artwork's width, in app/paper.css), so the
 * two halves can move independently. That matters because the mark has states,
 * and the states are the product: a contract cut in two is genuine when the
 * halves match and a forgery when they do not.
 *
 * Aspect ratio is fixed at the artwork's own 400×645.
 */
export type MarkState = "sealed" | "open" | "refused" | "drawing";

const RATIO = 400 / 645;

export function Mark({
  state = "sealed",
  size = 24,
  className = "",
  style,
}: {
  state?: MarkState;
  /** height in px; width follows the artwork's ratio */
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={`mark ${className}`}
      data-state={state}
      style={{ width: Math.round(size * RATIO), height: size, ...style }}
      aria-hidden="true"
    >
      <span className="mark__half mark__half--a" data-mark-half="a" />
      <span className="mark__half mark__half--b" data-mark-half="b" />
    </span>
  );
}
