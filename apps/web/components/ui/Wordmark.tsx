/**
 * The seal mark, small. Engine-turned: two concentric rings with radial
 * teeth between them, which is how a lathe-engraved rosette is actually
 * constructed. The full version is the hero (components/seal/), so the header
 * and the hero are visibly the same object at two sizes.
 */
export function SealMark({ size = 22 }: { size?: number }) {
  // Rounded to a fixed precision on purpose: Math.sin is not bit-identical
  // across JS engines, so raw floats here render one last digit differently on
  // the server than in the browser and React reports a hydration mismatch.
  const teeth = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return {
      x1: (12 + Math.cos(a) * 7).toFixed(3),
      y1: (12 + Math.sin(a) * 7).toFixed(3),
      x2: (12 + Math.cos(a) * 10.4).toFixed(3),
      y2: (12 + Math.sin(a) * 10.4).toFixed(3),
    };
  });
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className="shrink-0"
      fill="none"
    >
      <circle cx="12" cy="12" r="10.8" stroke="var(--brass-dim)" strokeWidth="1" />
      <circle cx="12" cy="12" r="7" stroke="var(--brass)" strokeWidth="0.8" />
      {teeth.map((t, i) => (
        <line
          key={i}
          x1={t.x1}
          y1={t.y1}
          x2={t.x2}
          y2={t.y2}
          stroke="var(--brass-dim)"
          strokeWidth="0.7"
        />
      ))}
      <circle cx="12" cy="12" r="2.6" fill="var(--brass)" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <SealMark />
      <span className="font-serif text-[1.35rem] leading-none tracking-[-0.01em] text-signal">
        Indenture
      </span>
    </span>
  );
}
