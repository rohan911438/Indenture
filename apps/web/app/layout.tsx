import type { Metadata } from "next";
import Link from "next/link";
import { Newsreader, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { SiteNav } from "@/components/SiteNav";
import { ProcessSpine } from "@/components/ProcessSpine";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { WalletButton } from "@/components/wallet/WalletButton";
import { getSharesState } from "@/lib/data";
import "./globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600"],
  variable: "--font-newsreader",
  display: "swap",
});
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Indenture",
  description:
    "A compliance-enforced, AI-managed fund on Hedera. Blocked attacks are the product.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const shares = await getSharesState();
  const identities = shares.wallets.map((w) => ({
    address: w.address,
    label: w.label,
    identityVerified: w.identityVerified,
    refusalReason: "refusalReason" in w ? w.refusalReason : undefined,
  }));

  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <body>
        <WalletProvider
          identities={identities}
          classFrozen={shares.shareClass.frozen}
          classFrozenReason={shares.shareClass.frozenReason}
        >
          <header className="border-b border-hairline">
            <div className="mx-auto max-w-deed px-6 py-5 flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
              <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
                <Link
                  href="/"
                  className="font-mono text-xs tracking-[0.3em] text-signal"
                >
                  INDENTURE
                </Link>
                <SiteNav />
              </div>
              <WalletButton />
            </div>
          </header>
          <ProcessSpine />
          <main className="mx-auto max-w-deed px-6 pt-14 pb-24">{children}</main>
          <footer className="mx-auto max-w-deed px-6 pb-12 text-xs text-slate">
            Read directly from the Hedera mirror node. No API routes, no
            database.
          </footer>
        </WalletProvider>
      </body>
    </html>
  );
}
