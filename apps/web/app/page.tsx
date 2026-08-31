import { MandateHero } from "@/components/MandateHero";
import { CovenantGauge } from "@/components/CovenantGauge";
import { getCovenantStatus, getMandate, getSharesState } from "@/lib/data";

export const revalidate = 5;

export default async function MandatePage() {
  const [mandate, covenants, shares] = await Promise.all([
    getMandate(),
    getCovenantStatus(),
    getSharesState(),
  ]);

  const supply = Number(shares.shareClass.totalSupply) / 1_000_000;
  const nav = supply * Number(shares.shareClass.navPerShare);

  return (
    <div className="space-y-16">
      <MandateHero mandate={mandate} />

      <section>
        <div className="font-mono text-xs uppercase tracking-[0.25em] text-slate">
          Net asset value
        </div>
        <div className="mt-2 font-serif text-[40px] leading-none text-signal tabular-nums">
          ${nav.toLocaleString("en-US", { maximumFractionDigits: 0 })}
        </div>
        <div className="mt-2 font-mono text-xs text-slate">
          {supply.toLocaleString("en-US")} shares · $
          {Number(shares.shareClass.navPerShare).toFixed(4)} / share
          {shares.shareClass.frozen && (
            <span className="ml-2 text-oxblood">— class frozen</span>
          )}
        </div>
      </section>

      <section>
        <div className="font-mono text-xs uppercase tracking-[0.25em] text-slate">
          Covenants, live
        </div>
        <div className="mt-6 grid grid-cols-1 gap-x-12 gap-y-8 sm:grid-cols-2">
          {covenants.map((c) => (
            <CovenantGauge key={c.key} status={c} />
          ))}
        </div>
      </section>
    </div>
  );
}
