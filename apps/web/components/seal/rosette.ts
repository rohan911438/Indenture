import type { CovenantStatus } from "@/lib/data";

/**
 * The guilloché rosette — the lathe engraving on a bond certificate.
 *
 * Why this and not a floating crypto blob: on a real bearer bond the engraving
 * is an anti-counterfeit device. It is information encoded as decoration. So
 * here it is driven by the fund's actual covenant headroom — the ornament IS
 * the state. A shape that spun for its own sake would be the opposite idea.
 *
 * Construction is the real one: two superimposed lathe patterns, each a family
 * of concentric curves pulled out of round by a sine on the angle, turning in
 * opposite directions. The field is then lit as intaglio relief — a numerical
 * gradient of the height field, a raking light from the upper left — so the
 * lines read as metal pressed into a plate rather than as strokes drawn on it.
 */

/** WebGL2 / GLSL ES 3.00 — ogl creates a webgl2 context and injects no version. */
export const VERT = /* glsl */ `#version 300 es
in vec2 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

export const FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform vec2  uResolution;
uniform float uPixel;    // one device pixel, in plate units
uniform float uTime;
uniform float uReveal;   // 0..1 — the burin cutting outward from the centre
uniform float uStress;   // 0..1 — how close the tightest covenant is to its limit
uniform float uAmp;      // how far out of round the figure is pulled
uniform float uPetalsA;  // integer, or the pattern seams at atan's discontinuity
uniform float uPetalsB;

uniform vec3 uInk;
uniform vec3 uInkDeep;
uniform vec3 uDim;
uniform vec3 uMid;
uniform vec3 uLit;
uniform vec3 uAlarm;
uniform vec3 uAlarmLit;

const float TAU = 6.283185307;

/** A smooth periodic ridge: 1 on the line, 0 between. Narrow as sharp rises. */
float ridge(float g, float sharp) {
  return pow(cos(g * TAU) * 0.5 + 0.5, sharp);
}

/**
 * The engraved height field, in plate units where the seal spans roughly
 * r = 0 .. 0.95. Bands by radius, as on a real certificate:
 *
 *   0.00 .. 0.19   the boss — a blind-embossed dome with a fine starburst
 *   0.21 .. 0.70   the guilloché proper, two counter-rotating patterns
 *   0.71 .. 0.78   the collar — radial teeth, engine-turned
 *   0.80 .. 0.87   two plain border rings
 */
float height(vec2 p, float t) {
  float r = length(p);
  float a = atan(p.y, p.x);

  float gA = r * 34.0 - uAmp * 1.75 * sin(uPetalsA * a + t * 0.33 + r * 7.0);
  float gB = r * 27.0 + uAmp * 2.10 * sin(uPetalsB * a - t * 0.24 - r * 5.0);
  float band = max(ridge(gA, 3.0), ridge(gB, 3.0) * 0.85);
  band *= smoothstep(0.200, 0.255, r) * (1.0 - smoothstep(0.660, 0.715, r));

  float teeth = ridge(a / TAU * 72.0, 2.0);
  teeth *= smoothstep(0.705, 0.725, r) * (1.0 - smoothstep(0.760, 0.782, r));

  float rings = ridge(r * 58.0, 6.0);
  rings *= smoothstep(0.795, 0.808, r) * (1.0 - smoothstep(0.858, 0.874, r));

  float inner = clamp(r / 0.19, 0.0, 1.0);
  float dome = sqrt(max(0.0, 1.0 - inner * inner)) * (1.0 - smoothstep(0.180, 0.196, r));
  float burst = ridge(a / TAU * 24.0, 4.0)
    * 0.28
    * smoothstep(0.035, 0.165, r)
    * (1.0 - smoothstep(0.178, 0.193, r));

  return band + teeth * 0.80 + rings * 0.95 + dome * 0.55 + burst;
}

void main() {
  // plate coordinates: square, centred, -1..1 on the short axis
  vec2 p = (vUv * uResolution * 2.0 - uResolution) / min(uResolution.x, uResolution.y);

  float t = uTime;

  // the lathe itself turns, slowly, under the precessing petals
  float rot = t * 0.035;
  float cs = cos(rot), sn = sin(rot);
  p = mat2(cs, -sn, sn, cs) * p;

  float r = length(p);

  // Outside the plate there is nothing — the canvas is transparent so the
  // CSS well behind it does the recessing.
  float plate = 1.0 - smoothstep(0.880, 0.992, r);
  if (plate <= 0.0015) {
    fragColor = vec4(0.0);
    return;
  }

  float h = height(p, t);

  // Intaglio relief: the normal of the height field, lit from the upper left.
  float e = max(uPixel, 0.0008);
  float hl = height(p - vec2(e, 0.0), t);
  float hr = height(p + vec2(e, 0.0), t);
  float hd = height(p - vec2(0.0, e), t);
  float hu = height(p + vec2(0.0, e), t);
  vec3 n = normalize(vec3(hl - hr, hd - hu, e * 16.0));

  vec3 L = normalize(vec3(-0.55, 0.72, 0.42));
  float diff = max(dot(n, L), 0.0);
  float spec = pow(max(dot(n, normalize(L + vec3(0.0, 0.0, 1.0))), 0.0), 24.0);

  // The metal heats toward oxblood as the tightest covenant approaches its
  // limit. Nothing else on the page needs to say it; the ornament has said it.
  // The ramp starts at half — a fund with real headroom stays brass, and the
  // colour is spent only where it means something.
  float heat = smoothstep(0.50, 1.0, uStress);
  vec3 dim = mix(uDim, uAlarm, heat);
  vec3 mid = mix(uMid, uAlarmLit, heat);
  vec3 lit = mix(uLit, uAlarmLit * 1.35, heat);

  vec3 metal = mix(dim, mid, smoothstep(0.04, 0.62, diff));
  metal = mix(metal, lit, spec);

  // The burin cuts outward from the boss on load.
  float cutR = uReveal * 1.12;
  float wipe = 1.0 - smoothstep(cutR - 0.13, cutR, r);
  float cover = clamp(h * 1.30, 0.0, 1.0) * wipe;

  vec3 base = mix(uInk, uInkDeep, smoothstep(0.0, 1.0, r) * 0.75);
  vec3 col = mix(base, metal, cover);

  // a bright lip where the tool is still cutting, gone once the cut is finished
  float edge = exp(-pow((r - cutR) / 0.030, 2.0)) * (1.0 - uReveal * uReveal);
  col += lit * edge * 0.6;

  fragColor = vec4(col, plate);
}
`;

// --- the live wiring -------------------------------------------------------

export interface SealState {
  /** 0 = all the headroom in the world, 1 = hard against a covenant */
  stress: number;
  /** petal counts, integers — a fraction seams the pattern */
  petalsA: number;
  petalsB: number;
  amp: number;
  /** the covenant driving it, for the caption and the screen-reader text */
  label: string | null;
}

/**
 * How full the tightest covenant is — the same ratio CovenantGauge draws, so
 * the seal and the gauges can never disagree about where the fund stands.
 */
export function usage(c: CovenantStatus): number {
  const raw =
    c.mode === "floor"
      ? c.limit / Math.max(c.current, 1)
      : c.current / Math.max(c.limit, 1);
  return Math.max(0, Math.min(1, raw));
}

export function sealFromCovenants(covenants: CovenantStatus[]): SealState {
  const tightest = covenants.reduce<CovenantStatus | null>(
    (worst, c) => (worst === null || usage(c) > usage(worst) ? c : worst),
    null,
  );
  const stress = tightest ? usage(tightest) : 0;

  // The figure tightens as the headroom closes: fewer, deeper lobes. Discrete
  // steps, because the petal count has to stay whole.
  const petalsA = stress > 0.85 ? 6 : stress > 0.6 ? 7 : 9;
  const petalsB = stress > 0.85 ? 11 : stress > 0.6 ? 12 : 13;

  return {
    stress,
    petalsA,
    petalsB,
    amp: 0.55 + stress * 0.75,
    label: tightest?.label ?? null,
  };
}

/** "#a6863c" -> [0.65, 0.53, 0.24] */
export function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

/** The palette the shader needs, read from the CSS tokens at runtime. */
export const SEAL_PALETTE = {
  ink: "#14181d",
  inkDeep: "#0b0e12",
  dim: "#6e5828",
  mid: "#a6863c",
  lit: "#d9b66a",
  alarm: "#6b2737",
  alarmLit: "#c8606f",
} as const;
