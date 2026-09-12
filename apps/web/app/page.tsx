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
import { existsSync } from "node:fs";
import { join } from "node:path";

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
  /**
   * The hero ground, if one has been dropped in.
   *
   * Checked on disk rather than assumed, so a missing file is a designed
   * placeholder rather than a broken image — and so the photograph can be
   * added by copying it into public/ with no code change at all. First match
   * wins, best format first.
   */
  const banner =
    ["hero.avif", "hero.webp", "hero.jpg", "hero.jpeg", "hero.png"]
      .map((name) => ({ name, path: join(process.cwd(), "public", name) }))
      .find((f) => existsSync(f.path))?.name ?? null;

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
        <Hero banner={banner ? `/${banner}` : null} />
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
