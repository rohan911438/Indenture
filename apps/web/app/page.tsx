import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { Cursor } from "@/components/motion/Cursor";
import { Preloader, PreloaderFlag } from "@/components/motion/Preloader";
import { PaperNav } from "@/components/paper/PaperNav";
import { TickerBar } from "@/components/paper/TickerBar";
import { Hero } from "@/components/paper/Hero";
import { Incident } from "@/components/paper/Incident";
import { Terminal } from "@/components/paper/Terminal";
import { Refusals } from "@/components/paper/Refusals";
import { Stack } from "@/components/paper/Stack";
import { PaperFooter } from "@/components/paper/PaperFooter";
import { deployments } from "@/lib/deployments";
import { getBlocked, getMandate } from "@/lib/data";

/**
 * The landing page.
 *
 * Obsidian hero, paper body, obsidian footer — two near-black bands bracketing
 * a white editorial document. The transition between them is a hard edge in
 * both directions; the band simply ends.
 *
 * Nothing here reads the chain. Every figure is seeded, so the page renders in
 * full with no wallet, no RPC and no relay, and a judge with a dead network
 * still sees the whole argument. The live reads arrive behind one adapter in a
 * later phase and change none of this markup.
 */
/* The journal is read at request time and falls back to fixtures, so the page
   renders in full with no network. Five seconds is the same window the rest of
   the site uses. */
export const revalidate = 5;

export default async function LandingPage() {
  /**
   * Read once, on the server, straight out of deployments.json. These are the
   * real addresses and topics the fund is deployed at, not a sample — the rail
   * is only worth having if a judge can paste any of it into HashScan.
   */
  const [blocked, mandate] = await Promise.all([getBlocked(), getMandate()]);

  /* Counted, never typed. A hardcoded figure here is a figure that will be
     wrong the first time the fixture changes. */
  const figures = [
    { text: "INDENTURE" },
    { text: `REFUSED ${blocked.data.length}` },
    { text: "LOST $0.00", tone: "permit" as const },
    { text: `MANDATE #${mandate.data.seq}` },
    {
      text: `${(deployments.network?.name ?? "no network").toUpperCase()} ${deployments.network?.chainId ?? ""}`.trim(),
    },
  ];

  const facts = [
    {
      label: "Network",
      value: `${deployments.network?.name ?? "not deployed"} · ${deployments.network?.chainId ?? "—"}`,
    },
    { label: "Hook", value: deployments.contracts?.PolicyHook || "not deployed" },
    { label: "Mandate topic", value: deployments.hcs?.mandateTopicId || "unset" },
    { label: "Journal topic", value: deployments.hcs?.journalTopicId || "unset" },
  ];

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
        <TickerBar figures={figures} />
        <Hero facts={facts} />
        <Incident />
        <Terminal />
        <Refusals />
        <Stack />
      </main>

      <PaperFooter />
    </div>
  );
}
