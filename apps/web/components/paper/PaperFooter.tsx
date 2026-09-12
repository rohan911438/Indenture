import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Rise } from "@/components/motion/Rise";

const COLUMNS = [
  {
    head: "The instrument",
    links: [
      { href: "/mandate", label: "Mandate" },
      { href: "/journal", label: "Journal" },
      { href: "/blocked", label: "Blocked" },
      { href: "/shares", label: "Shares" },
    ],
  },
  {
    head: "Source",
    links: [
      { href: "https://github.com/rohan911438/Indenture", label: "Repository" },
      { href: "https://hashscan.io/testnet", label: "HashScan" },
      { href: "/prospectus", label: "Earlier prospectus" },
    ],
  },
];

export function PaperFooter() {
  return (
    <footer className="on-obsidian" style={{ minHeight: 280 }}>
      <div className="shell grid gap-16 py-20 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Logo variant="horizontal" size={32} />
        </div>

        <Rise className="grid gap-12 sm:grid-cols-2 lg:col-span-5" start="top 95%" stagger={0.04}>
          {COLUMNS.map((col) => (
            <div key={col.head}>
              <p className="t-eyebrow" style={{ color: "var(--on-dark-2)" }}>
                {col.head}
              </p>
              <ul className="mt-6 flex flex-col gap-3">
                {col.links.map((l) => (
                  <li key={l.href} style={{ listStyle: "none" }}>
                    <Link className="nav__link t-small" href={l.href}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Rise>

        <div className="t-data-sm lg:col-span-3 lg:text-right" style={{ color: "var(--on-dark-2)" }}>
          <p>ETHONLINE 2026</p>
          <p className="mt-2">SUBMITTED 13 SEP 2026</p>
          <p className="mt-2">HEDERA TESTNET · CHAIN 296</p>
        </div>
      </div>
    </footer>
  );
}
