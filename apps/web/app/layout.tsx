import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Indenture",
  description: "A compliance-enforced, AI-managed fund on Hedera. Blocked attacks are the product.",
};

const NAV = [
  { href: "/", label: "Prospectus" },
  { href: "/blocked", label: "Blocked" },
  { href: "/journal", label: "Journal" },
  { href: "/shares", label: "Shares" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-mono">
        <header className="border-b border-neutral-800 px-6 py-4 flex gap-6 text-sm">
          <span className="font-bold">INDENTURE</span>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="text-neutral-400 hover:text-white">
              {n.label}
            </Link>
          ))}
        </header>
        <main className="px-6 py-8 max-w-4xl mx-auto">{children}</main>
      </body>
    </html>
  );
}
