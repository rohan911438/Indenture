import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { Cursor } from "@/components/motion/Cursor";
import { Preloader, PreloaderFlag } from "@/components/motion/Preloader";
import { PaperNav } from "@/components/paper/PaperNav";
import { Hero } from "@/components/paper/Hero";
import { Incident } from "@/components/paper/Incident";
import { Terminal } from "@/components/paper/Terminal";
import { Refusals } from "@/components/paper/Refusals";
import { Mechanism } from "@/components/paper/Mechanism";
import { Stack } from "@/components/paper/Stack";
import { PaperFooter } from "@/components/paper/PaperFooter";
import { readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * hero.png, hero-800.avif — the width group is optional.
 *
 * A literal, not a string built per format: in a template literal `\d` is not
 * an escape at all and collapses to a plain "d", so the assembled pattern
 * silently matched nothing.
 */
const HERO = /^hero(?:-(\d+))?\.([a-z0-9]+)$/;

/** Best format first; the browser takes the first one it can decode. */
const FORMATS = [
  ["avif", "image/avif"],
  ["webp", "image/webp"],
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["png", "image/png"],
] as const;

/**
 * The hero ground, read off disk rather than assumed.
 *
 * public/ is scanned for hero.<ext> and hero-<width>.<ext>, so the photograph
 * is added by copying files in and needs no code change, and a missing one is
 * a designed placeholder rather than a broken image.
 *
 * Widths matter here more than anywhere else on the site. The picture arrived
 * as a 1.7MB PNG and is the largest thing on the first screen; at 800px wide
 * it is a 19KB AVIF, and a phone has no use for the 2200px plate. Each format
 * becomes one <source> with a full srcset, and the browser picks twice — once
 * on what it can decode, once on how wide it actually is.
 */
function readGround() {
  const files = readdirSync(join(process.cwd(), "public"));

  const sources = FORMATS.map(([ext, type]) => {
    const candidates = files
      .map((f) => ({ f, m: HERO.exec(f) }))
      .filter((c) => c.m?.[2] === ext)
      .map((c) => ({ file: c.f, width: c.m![1] ? Number(c.m![1]) : 0 }))
      .sort((a, b) => a.width - b.width);
    if (candidates.length === 0) return null;
    return {
      type,
      // A width-less hero.<ext> carries no descriptor, which is exactly right:
      // it is then the only candidate and the browser uses it unconditionally.
      srcSet: candidates
        .map((c) => (c.width ? `/${c.file} ${c.width}w` : `/${c.file}`))
        .join(", "),
      widest: `/${candidates[candidates.length - 1].file}`,
    };
  }).filter((s) => s !== null);

  if (sources.length === 0) return null;
  return { sources, fallback: sources[sources.length - 1].widest };
}

/**
 * The landing page.
 *
 * Obsidian hero, paper body, obsidian footer — two near-black bands bracketing
 * a white editorial document. The transition between them is a hard edge in
 * both directions; the band simply ends.
 *
 * The hero is the whole first screen and carries nothing but the claim. The
 * ticker and the fact rail that used to bracket it are gone: both were strips
 * of small type competing with a headline that is supposed to be the only
 * thing on that screen. The deployment addresses and topic ids they carried
 * are still on the page, in the stack section, where someone looking for them
 * will actually go.
 *
 * Nothing here reads the chain, so the page is fully static and renders with
 * no wallet, no RPC and no relay.
 */
export default function LandingPage() {
  const ground = readGround();

  return (
    <div className="paper-root">
      {/* Runs before first paint; decides whether the overlay below is ever
          shown at all. */}
      <PreloaderFlag />
      <Preloader />
      <SmoothScroll />
      <Cursor />

      <PaperNav />

      <main id="main">
        <Hero ground={ground} />
        <Incident />
        <Terminal />
        <Refusals />
        <Mechanism />
        <Stack />
      </main>

      <PaperFooter />
    </div>
  );
}
