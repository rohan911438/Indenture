import type { Config } from "tailwindcss";

/**
 * Tokens are the source of truth in app/globals.css :root — mirrored here so
 * Tailwind utilities (bg-ink, text-signal, border-hairline…) resolve to the
 * same values. See shared-contracts/design-tokens.md.
 */
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        "ink-raised": "var(--ink-raised)",
        bone: "var(--bone)",
        brass: "var(--brass)",
        oxblood: "var(--oxblood)",
        slate: "var(--slate)",
        signal: "var(--signal)",
        hairline: "var(--hairline)",
      },
      fontFamily: {
        serif: ["var(--font-newsreader)", "Newsreader", "Georgia", "serif"],
        sans: ["var(--font-plex-sans)", "IBM Plex Sans", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "IBM Plex Mono", "ui-monospace", "monospace"],
      },
      maxWidth: {
        deed: "760px",
      },
    },
  },
  plugins: [],
} satisfies Config;
