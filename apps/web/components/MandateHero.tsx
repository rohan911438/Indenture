import type { MandateView } from "@/lib/data";

const pct = (bps: number) => `${(bps / 100).toLocaleString("en-US")}%`;
const usd = (units6: string) =>
  "$" + Math.round(Number(units6) / 1_000_000).toLocaleString("en-US");

function Num({ children }: { children: React.ReactNode }) {
  return <span className="numeral">{children}</span>;
}

/**
 * The mandate as a sentence, built from the compiled covenant values — the
 * numbers are the real thing, set in italic brass (the one flourish).
 */
export function MandateHero({ mandate }: { mandate: MandateView }) {
  return (
    <section>
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-slate">
        The mandate
      </p>
      <h1 className="mt-4 font-serif text-[26px] leading-[1.5] text-signal">
        Fund One may hold no more than <Num>{pct(mandate.maxPositionBps)}</Num>{" "}
        of net assets in any single position, must keep at least{" "}
        <Num>{pct(mandate.minCashBps)}</Num> in the quote currency, and may not
        trade more than <Num>{usd(mandate.maxTradeNotional)}</Num> in one
        transaction or <Num>{usd(mandate.maxDailyNotional)}</Num> in any rolling
        24&nbsp;hours.
      </h1>
      <p className="mt-5 font-mono text-xs text-slate break-all">
        indenture {mandate.mandateHash} · seq {mandate.seq}
      </p>
    </section>
  );
}
