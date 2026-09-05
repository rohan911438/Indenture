"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Mandate" },
  { href: "/journal", label: "Journal" },
  { href: "/blocked", label: "Blocked" },
  { href: "/shares", label: "Shares" },
];

export function SiteNav() {
  const path = usePathname();
  return (
    <nav className="flex gap-6 text-sm">
      {NAV.map((n) => {
        const active =
          n.href === "/" ? path === "/" : path.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={
              "pb-1 -mb-1 border-b transition-colors " +
              (active
                ? "text-signal border-brass"
                : "text-slate border-transparent hover:text-signal")
            }
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
