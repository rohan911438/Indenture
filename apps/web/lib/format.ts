/**
 * Presentation-only formatters. Shared so the mandate sentence reads the same
 * on the certificate band, on /mandate and in the 404 — three places that
 * quoted the same clause with three slightly different roundings before.
 *
 * Nothing here reads a source. lib/data.ts remains the only seam.
 */

/** basis points as a percentage: 3000 -> "30%" */
export function pctFromBps(bps: number): string {
  const pct = bps / 100;
  return `${pct.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
}

/** 6-decimal quote units as whole dollars: "250000000000" -> "$250,000" */
export function usdFromUnits6(units6: string | number): string {
  return (
    "$" +
    Math.round(Number(units6) / 1_000_000).toLocaleString("en-US")
  );
}

/** whole dollars from a number already in dollars */
export function usd(value: number): string {
  return "$" + Math.round(value).toLocaleString("en-US");
}

/** 6-decimal share units as a share count */
export function sharesFromUnits6(units6: string | number): number {
  return Number(units6) / 1_000_000;
}

export function fmtUtc(unixSeconds: number): string {
  return (
    new Date(unixSeconds * 1000)
      .toISOString()
      .replace("T", " ")
      .replace(/\.\d+Z$/, "") + " UTC"
  );
}

/**
 * The mandate as one sentence, built from the compiled covenant values. This is
 * the text printed on the certificate band, so it has to be the numbers the
 * Validator actually enforces rather than a paraphrase of them.
 */
export function mandateSentence(m: {
  maxPositionBps: number;
  minCashBps: number;
  maxTradeNotional: string;
  maxDailyNotional: string;
}): string {
  return (
    `Fund One may hold no more than ${pctFromBps(m.maxPositionBps)} of net assets ` +
    `in any single position, must keep at least ${pctFromBps(m.minCashBps)} in the ` +
    `quote currency, and may not trade more than ${usdFromUnits6(m.maxTradeNotional)} ` +
    `in one transaction or ${usdFromUnits6(m.maxDailyNotional)} in a single day.`
  );
}

/**
 * True for rows the attack console produced in the browser.
 *
 * The console asks the live Validator and shows you its real answer, but only
 * the Manager writes to the journal topic — so a refusal fired from this page
 * has no consensus sequence number and no HashScan record. Its `seq` is a local
 * counter. Presenting that as a Hedera sequence, or linking it to a topic
 * message that does not exist, would be the exact kind of small permanent lie
 * this project refuses to tell about its own data.
 */
export function isConsoleRow(body: { source?: string }): boolean {
  return body.source === "validator" || body.source === "rehearsal";
}
