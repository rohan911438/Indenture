"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Five routes. The prospectus is the document a fund hands someone who is
 * deciding whether to trust it.
 *
 * It used to be the landing page. The landing is now its own thing in the paper
 * system, so this points at where the prospectus actually lives rather than at
 * a route that no longer renders it.
 */
const NAV = [
  { href: "/prospectus", label: "Prospectus" },
  { href: "/mandate", label: "Mandate" },
  { href: "/journal", label: "Journal" },
  { href: "/blocked", label: "Blocked" },
  { href: "/shares", label: "Shares" },
];

export function SiteNav() {
  const path = usePathname();
  return (
    <nav aria-label="Sections" className="flex flex-wrap gap-x-5 gap-y-1 sm:gap-x-7">
      {NAV.map((n) => {
        const active = path.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={
              "-mb-px border-b-2 pb-1 font-sans text-meta transition-colors duration-150 " +
              (active
                ? "border-brass text-signal"
                : "border-transparent text-slate-lit hover:border-hairline hover:text-signal")
            }
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
