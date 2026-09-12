/**
 * Demo mode — the thing that keeps a judge from ever hitting a wall.
 *
 * A gated route is gated on reading a *wallet*, not on permission: everything
 * behind it is public record on a testnet. So "View demo" is not a bypass of
 * anything, it is an admission that asking someone to install a wallet before
 * they can look at a hackathon submission is how you lose them.
 *
 * The cookie is deliberately not httpOnly and carries no identity. It exists so
 * the choice survives a navigation.
 */
export const DEMO_COOKIE = "indenture-demo";
export const DEMO_PARAM = "demo";

/** Client-side: has this browser asked for the demo? */
export function readDemoCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .some((c) => c.trim() === `${DEMO_COOKIE}=1`);
}

export function writeDemoCookie(): void {
  if (typeof document === "undefined") return;
  // Session-scoped on purpose: a demo is a visit, not a preference.
  document.cookie = `${DEMO_COOKIE}=1; path=/; SameSite=Lax`;
}

export function clearDemoCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${DEMO_COOKIE}=; path=/; Max-Age=0; SameSite=Lax`;
}
