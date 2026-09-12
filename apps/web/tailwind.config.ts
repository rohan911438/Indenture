import type { Config } from "tailwindcss";

/**
 * Tokens are the source of truth in app/globals.css :root — mirrored here so
 * Tailwind utilities (bg-ink, text-slate-lit, border-hairline…) resolve to the
 * same values. See shared-contracts/design-tokens.md.
 *
 * The type scale is named by ROLE, not by size, so a component cannot quietly
 * invent a 19px heading: display / heading / subheading / lede / body / meta /
 * data / micro is the whole ladder.
 */
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "var(--ink)",
          deep: "var(--ink-deep)",
          raised: "var(--ink-raised)",
        },
        bone: {
          DEFAULT: "var(--bone)",
          deep: "var(--bone-deep)",
        },
        brass: {
          DEFAULT: "var(--brass)",
          dim: "var(--brass-dim)",
          bright: "var(--brass-bright)",
        },
        oxblood: {
          DEFAULT: "var(--oxblood)",
          edge: "var(--oxblood-edge)",
          lit: "var(--oxblood-lit)",
        },
        slate: {
          DEFAULT: "var(--slate)",
          lit: "var(--slate-lit)",
        },
        signal: "var(--signal)",
        hairline: {
          DEFAULT: "var(--hairline)",
          bone: "var(--hairline-bone)",
        },
      },
      fontFamily: {
        serif: ["var(--font-newsreader)", "Newsreader", "Georgia", "serif"],
        sans: ["var(--font-plex-sans)", "IBM Plex Sans", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "IBM Plex Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        lede: ["1.25rem", { lineHeight: "1.55" }],
        body: ["1.0625rem", { lineHeight: "1.65" }],
        meta: ["0.9375rem", { lineHeight: "1.5" }],
        data: ["0.8125rem", { lineHeight: "1.5", letterSpacing: "-0.005em" }],
        micro: ["0.6875rem", { lineHeight: "1.45" }],
      },
      maxWidth: {
        /* The reading measure. Demoted from "the width of the site" to what it
           always should have been: the width of a paragraph. */
        deed: "760px",
        page: "1280px",
      },
      spacing: {
        /* Vertical rhythm between the landing's movements. Adjacent sections
           each apply it, so the figure is half the gap you actually see. */
        movement: "clamp(3.25rem, 6.5vh, 5rem)",
      },
      gridTemplateColumns: {
        page: "repeat(12, minmax(0, 1fr))",
      },
      transitionTimingFunction: {
        /* Engraved, not bouncy. */
        press: "cubic-bezier(0.16, 0.84, 0.28, 1)",
      },
    },
  },
  plugins: [],
} satisfies Config;
