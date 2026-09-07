import Link from "next/link";
import { MandateHero } from "@/components/MandateHero";
import { CovenantGauge } from "@/components/CovenantGauge";
import {
  getBlocked,
  getCovenantStatus,
  getMandate,
  getSharesState,
} from "@/lib/data";
import type { ReceiptBody } from "@/lib/types";

export const revalidate = 5;

export default async function MandatePage() {
  const [mandateSrc, covenantsSrc, sharesSrc, blockedSrc] = await Promise.all([
    getMandate(),
    getCovenantStatus(),
    getSharesState(),
    getBlocked(),
  ]);
  const mandate = mandateSrc.data;
  const covenants = covenantsSrc.data;
  const shares = sharesSrc.data;
  const blocked = blockedSrc.data;

  const supply = Number(shares.shareClass.totalSupply) / 1_000_000;
  const nav = supply * Number(shares.shareClass.navPerShare);

  const refusals = blocked.filter(
    (r) => r.type === "RECEIPT" && (r.body as ReceiptBody).decision === "REFUSED",
  ).length;
  const breaches = blocked.filter((r) => r.type === "BREACH").length;

  const tightest = [...covenants].sort((a, b) => {
    const ra = a.mode === "floor" ? a.limit / a.current : a.current / a.limit;
    const rb = b.mode === "floor" ? b.limit / b.current : b.current / b.limit;
    return rb - ra;
  })[0];

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
        <Link
          href="/blocked"
          className="mt-4 inline-flex items-baseline gap-2 border-b border-oxblood/50 pb-0.5 font-sans text-sm text-signal hover:border-oxblood"
        >
          <span className="font-mono text-oxblood tabular-nums">
            {refusals}
          </span>
          trades refused
          {breaches > 0 && (
            <>
              <span className="text-slate">·</span>
              <span className="font-mono text-oxblood tabular-nums">
                {breaches}
              </span>
              breach{breaches === 1 ? "" : "es"} caught
            </>
          )}
          <span className="text-slate">— see the wall ↗</span>
        </Link>
      </section>

      <section>
        <div className="flex items-baseline justify-between gap-4">
          <div className="font-mono text-xs uppercase tracking-[0.25em] text-slate">
            {covenantsSrc.live ? "Covenants, live" : "Covenants, sample"}
          </div>
          {tightest && (
            <div className="font-mono text-[11px] text-slate">
              closest to a limit: {tightest.label}
            </div>
          )}
        </div>
        {covenantsSrc.note && (
          <p className="mt-2 font-mono text-[11px] text-oxblood">
            {covenantsSrc.note}
          </p>
        )}
        <div className="mt-6 grid grid-cols-1 gap-x-12 gap-y-8 sm:grid-cols-2">
          {covenants.map((c) => (
            <CovenantGauge key={c.key} status={c} />
          ))}
        </div>
      </section>

      <section className="border-t border-hairline pt-8">
        <p className="font-serif text-[17px] leading-relaxed text-signal">
          The proof is not that the fund performs. It is that a fully
          compromised AI, or a compromised Validator signature, still cannot
          move a dollar outside this mandate.
        </p>
        <Link
          href="/blocked"
          className="mt-3 inline-block font-sans text-sm text-brass hover:underline"
        >
          Watch the Validator refuse an attack →
        </Link>
      </section>
    </div>
  );
}
