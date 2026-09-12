"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { ConnectAction } from "./ConnectAction";

const LINKS = [
  { href: "/mandate", label: "Mandate" },
  { href: "/journal", label: "Journal" },
  { href: "/blocked", label: "Blocked" },
  { href: "/shares", label: "Shares" },
];

/**
 * The bar is transparent over the hero and becomes paper past it.
 *
 * It sits inside the obsidian band's own scope until it sticks, so its links
 * inherit the dark neutrals for free and need no dark variant — the moment it
 * turns paper, the same tokens resolve to ink.
 */
export function PaperNav() {
  /**
   * The bar is paper everywhere now that the hero is too. `stuck` no longer
   * changes its colours — only whether it carries the hairline that separates
   * it from what has scrolled up behind it.
   */
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className="nav shell" data-stuck={stuck}>
      <Link href="/" aria-label="Indenture, home" className="nav__logo flex items-center">
        <Logo variant="horizontal" size={30} />
      </Link>

      <div className="nav__links">
        {/* Its own class, not .nav__links: that rule sets display:flex from a
            stylesheet loaded after Tailwind's utilities, so at equal
            specificity it was quietly beating `hidden` and pushing the bar 87px
            past the viewport on a phone. */}
        <div className="nav__group">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="nav__link">
              {l.label}
            </Link>
          ))}
        </div>
        <ConnectAction />
      </div>
    </nav>
  );
}
