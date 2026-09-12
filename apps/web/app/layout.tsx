import type { Metadata } from "next";
import {
  Newsreader,
  IBM_Plex_Sans,
  IBM_Plex_Mono,
  Plus_Jakarta_Sans,
  JetBrains_Mono,
} from "next/font/google";
import { ChoreographyFlag } from "@/components/motion/ChoreographyFlag";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { getSharesState } from "@/lib/data";
import "./globals.css";
import "./paper.css";

/* Editorial prose, on both systems. A legal instrument reads in a serif. */
const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600"],
  variable: "--font-newsreader",
  display: "swap",
});

/**
 * Satoshi is the display and UI face, fetched from Fontshare in the document
 * head. Plus Jakarta Sans is bundled behind it and takes over unchanged if that
 * request never lands — same geometry, same tall x-height, no layout shift
 * worth the name. Never Inter, and never Space Grotesk.
 */
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-jakarta",
  display: "swap",
});

/* Every address, hash, figure, covenant name, revert reason and timestamp. */
const jbMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-jbmono",
  display: "swap",
});

/* The older ink/bone pages are still set in Plex. */
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
  metadataBase: new URL("https://indenture.vercel.app"),
  title: "Indenture — the pool that says no.",
  description:
    "A Uniswap v4 hook that refuses two things a pool has never been able to refuse: a buyer who isn't qualified, and a manager exceeding his mandate.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sharesSrc = await getSharesState();
  const shares = sharesSrc.data;
  const identities = shares.wallets.map((w) => ({
    address: w.address,
    label: w.label,
    identityVerified: w.identityVerified,
    refusalReason: "refusalReason" in w ? w.refusalReason : undefined,
  }));

  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${jakarta.variable} ${jbMono.variable} ${plexSans.variable} ${plexMono.variable}`}
      /**
       * ChoreographyFlag adds a class here from a blocking script, before React
       * hydrates, because the decision depends on the reader's motion
       * preference and has to be made before first paint. That leaves the
       * client with one class the server HTML did not have. This suppresses the
       * warning for this element's own attributes only — a real mismatch
       * anywhere below is still reported.
       */
      suppressHydrationWarning
    >
      <head>
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap"
        />
      </head>
      <body>
        {/* Runs before first paint, so nothing a choreography is about to
            reveal is ever visible unanimated for a frame. */}
        <ChoreographyFlag />
        <WalletProvider
          identities={identities}
          classFrozen={shares.shareClass.frozen}
          classFrozenReason={shares.shareClass.frozenReason}
          registryLive={sharesSrc.live}
        >
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-ink-raised focus:px-4 focus:py-2 focus:text-signal"
          >
            Skip to content
          </a>
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
