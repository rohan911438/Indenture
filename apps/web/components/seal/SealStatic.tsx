import { type SealState } from "@/components/seal/rosette";

/**
 * The seal without WebGL: the same guilloché, drawn as real SVG curves.
 *
 * This is not a placeholder box — it is the identical construction. Ring k of
 * lathe pattern A is the locus r = (k + amp·1.75·sin(pA·θ)) / 34, which is the
 * same equation the shader solves per pixel, so the fallback and the canvas are
 * the same object drawn two ways.
 *
 * It is the server-rendered default, the reduced-motion seal, and the
 * no-WebGL seal. The page never depends on the canvas.
 */

const SAMPLES = 72;
const R = 92; // plate radius in viewBox units (viewBox is -100..100)

function curve(
  k: number,
  ringScale: number,
  amp: number,
  petals: number,
  sign: 1 | -1,
): string {
  const pts: string[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const a = (i / SAMPLES) * Math.PI * 2;
    const r = (k + sign * amp * Math.sin(petals * a)) / ringScale;
    const x = Math.cos(a) * r * R;
    const y = Math.sin(a) * r * R;
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return "M" + pts.join("L") + "Z";
}

function rosettePaths(s: SealState): string[] {
  const out: string[] = [];
  // lathe A — every second ring, which reads the same at this size
  for (let k = 8; k <= 23; k += 2) {
    out.push(curve(k, 34, s.amp * 1.75, s.petalsA, 1));
  }
  // lathe B — counter-turned
  for (let k = 7; k <= 18; k += 2) {
    out.push(curve(k, 27, s.amp * 2.1, s.petalsB, -1));
  }
  return out;
}

/**
 * Coordinates are rounded to a fixed precision before they reach the DOM.
 * Math.sin is not bit-identical across JS engines, so raw floats differ in the
 * last digit between the server render and the browser, which React reports as
 * a hydration mismatch. The curve() path data above rounds for the same reason.
 */
function radial(count: number, r0: number, r1: number) {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    return {
      x1: (Math.cos(a) * r0 * R).toFixed(3),
      y1: (Math.sin(a) * r0 * R).toFixed(3),
      x2: (Math.cos(a) * r1 * R).toFixed(3),
      y2: (Math.sin(a) * r1 * R).toFixed(3),
    };
  });
}

/** Ring radii, rounded for the same reason. */
const ring = (f: number) => (f * R).toFixed(3);

export function SealStatic({
  state,
  className = "",
  title,
}: {
  state: SealState;
  className?: string;
  /** the accessible description — the seal is reporting a real measurement */
  title: string;
}) {
  const paths = rosettePaths(state);
  const teeth = radial(48, 0.715, 0.775);
  const burst = radial(24, 0.055, 0.185);

  // The engraving heats toward oxblood as the tightest covenant closes up.
  const line = state.stress > 0.85 ? "var(--oxblood-edge)" : "var(--brass-dim)";
  const hi = state.stress > 0.85 ? "var(--oxblood-lit)" : "var(--brass)";

  return (
    <svg
      viewBox="-100 -100 200 200"
      role="img"
      aria-label={title}
      className={className}
    >
      <defs>
        <radialGradient id="seal-plate" cx="50%" cy="34%" r="72%">
          <stop offset="0%" stopColor="var(--ink)" />
          <stop offset="100%" stopColor="var(--ink-deep)" />
        </radialGradient>
        <radialGradient id="seal-boss" cx="38%" cy="32%" r="78%">
          <stop offset="0%" stopColor={hi} stopOpacity="0.55" />
          <stop offset="100%" stopColor={line} stopOpacity="0.12" />
        </radialGradient>
      </defs>

      <circle r={R} fill="url(#seal-plate)" />

      {/* the guilloché. A second copy, offset up-left in the highlight colour,
          is the relief: the lit lip of a line pressed into the plate. */}
      <g fill="none" strokeWidth="0.55">
        <g stroke={hi} opacity="0.34" transform="translate(-0.5,-0.5)">
          {paths.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
        <g stroke={line} opacity="0.9">
          {paths.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
      </g>

      {/* the collar */}
      <g stroke={line} strokeWidth="0.6" opacity="0.75">
        {teeth.map((t, i) => (
          <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} />
        ))}
      </g>

      {/* the border rings */}
      <g fill="none">
        <circle r={ring(0.80)} stroke={line} strokeWidth="0.7" opacity="0.8" />
        <circle r={ring(0.845)} stroke={hi} strokeWidth="0.5" opacity="0.45" />
        <circle r={ring(0.87)} stroke={line} strokeWidth="0.7" opacity="0.8" />
      </g>

      {/* the boss: blind-embossed, with its starburst */}
      <circle r={ring(0.19)} fill="url(#seal-boss)" />
      <g stroke={hi} strokeWidth="0.45" opacity="0.5">
        {burst.map((t, i) => (
          <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} />
        ))}
      </g>
      <circle
        r={ring(0.19)}
        fill="none"
        stroke={line}
        strokeWidth="0.8"
        opacity="0.9"
      />
    </svg>
  );
}
