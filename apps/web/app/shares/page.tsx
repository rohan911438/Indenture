import { SharesPanel } from "@/components/SharesPanel";
import { getSharesState } from "@/lib/data";

export const revalidate = 5;

/**
 * The ERC-3643 share class. Supply, holders, and — the point of the page —
 * whether a given wallet can subscribe, with the exact refusal reason when it
 * can't. A portfolio breach freezes the whole class.
 */
export default async function SharesPage() {
  const state = await getSharesState();
  const { shareClass } = state;
  const supply = Number(shareClass.totalSupply) / 1_000_000;

  return (
    <div className="space-y-12">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-slate">
          Shares
        </p>
        <h1 className="mt-4 font-serif text-[26px] leading-snug text-signal">
          {shareClass.name} — an ERC-3643 security token. Transfers require a
          verified identity; a mandate breach freezes the class.
        </h1>
      </header>

      <dl className="grid grid-cols-2 gap-y-3 gap-x-8 max-w-md font-mono text-sm">
        <dt className="text-slate">Token</dt>
        <dd className="text-signal break-all">{shareClass.token}</dd>
        <dt className="text-slate">Total supply</dt>
        <dd className="text-signal tabular-nums">
          {supply.toLocaleString("en-US")}
        </dd>
        <dt className="text-slate">Holders</dt>
        <dd className="text-signal tabular-nums">{shareClass.holders}</dd>
        <dt className="text-slate">NAV / share</dt>
        <dd className="text-signal tabular-nums">
          ${Number(shareClass.navPerShare).toFixed(4)}
        </dd>
        <dt className="text-slate">Status</dt>
        <dd className={shareClass.frozen ? "text-oxblood" : "text-brass"}>
          {shareClass.frozen ? "FROZEN — mandate in breach" : "open"}
        </dd>
      </dl>

      <SharesPanel state={state} />
    </div>
  );
}
