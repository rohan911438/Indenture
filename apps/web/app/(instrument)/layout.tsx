import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import { Wordmark } from "@/components/ui/Wordmark";
import { ExternalLink } from "@/components/ui/ExternalLink";
import { Shell } from "@/components/ui/Shell";
import { WalletButton } from "@/components/wallet/WalletButton";
import { hashscanTopic, JOURNAL_TOPIC_ID } from "@/lib/data";
import { MANDATE_TOPIC } from "@/lib/deployments";

/**
 * The instrument chrome — the header, footer and intaglio grain that the
 * ink/bone/brass pages have always carried.
 *
 * This moved out of the root layout when the landing page changed systems. The
 * routes below are byte-for-byte what they were; only the element that wraps
 * them moved, so the grain and the dark header no longer reach a paper page
 * that wants neither.
 */
export default function InstrumentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="instrument-ground">
      <header className="sticky top-0 z-40 border-b border-hairline bg-ink/92 backdrop-blur-sm">
        <Shell className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 py-4">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <Link href="/" aria-label="Indenture, home">
              <Wordmark />
            </Link>
            <SiteNav />
          </div>
          <WalletButton />
        </Shell>
      </header>

      <main id="main">{children}</main>

      <footer className="mt-movement border-t border-hairline py-10">
        <Shell className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <p className="max-w-deed font-sans text-data text-slate-lit">
            Every figure on this site is read from the Hedera mirror node and
            the JSON-RPC relay at request time. There are no API routes and no
            database. Where a number cannot be read, the page says so instead of
            filling the gap.
          </p>
          <div className="flex flex-col gap-1.5 font-sans text-data text-slate-lit sm:text-right">
            <ExternalLink href={hashscanTopic(MANDATE_TOPIC)}>
              Mandate topic {MANDATE_TOPIC || "(unset)"}
            </ExternalLink>
            <ExternalLink href={hashscanTopic(JOURNAL_TOPIC_ID)}>
              Journal topic {JOURNAL_TOPIC_ID || "(unset)"}
            </ExternalLink>
          </div>
        </Shell>
      </footer>
    </div>
  );
}
