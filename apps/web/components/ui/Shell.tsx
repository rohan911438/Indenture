/**
 * The page container. 1280px and a 12-column grid — the site is wide now, and
 * the 760px measure is what a PARAGRAPH gets, not what the page gets.
 */
export function Shell({
  children,
  className = "",
  as: As = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "header" | "footer" | "main";
}) {
  return (
    <As className={`mx-auto w-full max-w-page px-6 sm:px-8 lg:px-12 ${className}`}>
      {children}
    </As>
  );
}

/** The 12-column grid, for the asymmetric placements. */
export function Grid({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-4 gap-x-6 gap-y-8 lg:grid-cols-page lg:gap-x-8 ${className}`}>
      {children}
    </div>
  );
}
