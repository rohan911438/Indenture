/**
 * A link that leaves the site.
 *
 * No "↗" appended to the text — the glyph is a real mark, outside the link's
 * words, that says this opens elsewhere. That is information (it changes what
 * happens when you click), which is the only reason a mark earns its place.
 */
export function ExternalLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`link inline-flex items-baseline gap-1.5 ${className}`}
    >
      <span>{children}</span>
      <svg
        aria-hidden
        viewBox="0 0 10 10"
        width="9"
        height="9"
        className="shrink-0 translate-y-[-1px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      >
        <path d="M3 1h6v6" />
        <path d="M9 1L1 9" />
      </svg>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
