import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Eyebrow } from "@/components/paper/Primitives";

/**
 * The 404.
 *
 * It lives at the app root rather than inside a route group, because a URL that
 * matches no route belongs to no group — a not-found nested in one only ever
 * catches the routes already inside it.
 */
export const metadata = { title: "Not found — Indenture" };

const ROUTES = [
  { href: "/", label: "The landing" },
  { href: "/mandate", label: "The mandate" },
  { href: "/journal", label: "The journal" },
  { href: "/blocked", label: "Blocked attempts" },
  { href: "/shares", label: "Shares" },
  { href: "/prospectus", label: "The earlier prospectus" },
];

export default function NotFound() {
  return (
    <div className="paper-root">
      <main
        id="main"
        className="shell"
        style={{ minHeight: "100vh", display: "grid", alignContent: "center", paddingBlock: 120 }}
      >
        <Link href="/" aria-label="Indenture, home" style={{ width: "fit-content" }}>
          <Logo variant="horizontal" size={28} />
        </Link>

        <Eyebrow className="mt-20">404</Eyebrow>

        <h1 className="t-display-l" style={{ marginTop: 48, maxWidth: "18ch" }}>
          No such clause in this indenture.
        </h1>

        <p className="t-prose" style={{ marginTop: 40, color: "var(--ink-2)" }}>
          That address is not one of the pages this site has. Everything the fund
          publishes is listed below.
        </p>

        <nav className="mt-16 flex flex-wrap gap-x-10 gap-y-4">
          {ROUTES.map((r) => (
            <Link key={r.href} href={r.href} className="nav__link t-data-sm">
              {r.label.toUpperCase()}
            </Link>
          ))}
        </nav>
      </main>
    </div>
  );
}
