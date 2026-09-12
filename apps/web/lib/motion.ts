/**
 * Motion tokens. Never hand-write a duration.
 *
 * The numbers are a scale, not preferences: anything below 400ms is a
 * micro-interaction, anything above 1.2s is the preloader or a pin, and
 * everything in between is a reveal. A duration that is not on this list is a
 * duration nobody chose.
 */
export const D = { xs: 0.24, sm: 0.4, md: 0.7, lg: 1.1, xl: 1.8 } as const;

export const E = {
  out: "power3.out",
  big: "expo.out",
  inOut: "power2.inOut",
  snap: "back.out(1.7)",
} as const;

export const STAGGER = { line: 0.07, row: 0.045, card: 0.09 } as const;
