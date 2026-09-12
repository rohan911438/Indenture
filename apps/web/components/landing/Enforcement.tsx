import Link from "next/link";
import { CovenantGauge } from "@/components/CovenantGauge";
import { Shell } from "@/components/ui/Shell";
import { SourceNote } from "@/components/ui/SourceNote";
import type { CovenantStatus } from "@/lib/data";

/**
 * The honest split, and the most important section on the site.
 *
 * Not every covenant is enforced the same way, and a page that implied
 * otherwise would be making exactly the overclaim this project exists to avoid.
 * The two size covenants read nothing but the swap parameters and the policy's
 * own storage — no price, no external call — so they hold even against a stolen
 * Validator key. The two weight covenants are ratios against net asset value,
 * which cannot be computed without a price, and the hook is not allowed to read
 * an oracle. Those are checked before signing and observed on-chain afterwards,
 * where a breach freezes the share class rather than reverting.
 *
 * Built as two panels with different surfaces, not two columns of prose: one
 * raised and brass-edged, one recessed and oxblood-edged, each stating where its
 * check physically runs. Grouping the live gauges under the mechanism that backs
 * them is what makes them worth showing — each bar now says how it is enforced,
 * not just where it stands. The wording follows MandatePolicy.sol.
 */
const UNCONDITIONAL = new Set(["maxTradeNotional", "maxDailyNotional"]);

function Panel({
  tone,
  where,
  title,
  children,
}: {
  tone: "held" | "observed";
  where: string;
  title: string;
  children: React.ReactNode;
}) {
  const held = tone === "held";
  return (
    <section
      className={`flex flex-col ${held ? "bg-ink-raised/50" : "bg-ink-deep/60"}`}
    >
      <div aria-hidden className={`h-0.5 ${held ? "bg-brass" : "bg-oxblood-edge"}`} />
      <div className="flex flex-1 flex-col border border-t-0 border-hairline p-7 sm:p-9">
        <p
          className={`font-sans text-micro ${held ? "text-brass" : "text-oxblood-lit"}`}
        >
          {where}
        </p>
        <h3 className="subheading mt-3 text-signal">{title}</h3>
        {children}
      </div>
    </section>
  );
}

export function Enforcement({
  covenants,
  live,
  note,
}: {
  covenants: CovenantStatus[];
  live: boolean;
  note?: string;
}) {
  const held = covenants.filter((c) => UNCONDITIONAL.has(c.key));
  const observed = covenants.filter((c) => !UNCONDITIONAL.has(c.key));

  return (
    <Shell as="section" className="py-movement">
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 lg:grid-cols-12">
        <h2 className="heading text-signal lg:col-span-5">
          Two kinds of covenant
        </h2>
        <p className="text-lede text-slate-lit lg:col-span-6 lg:col-start-7">
          They are not enforced the same way, and the difference is the honest
          limit of what this fund can promise.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Panel
          tone="held"
          where="Runs inside the swap, in the policy contract"
          title="Enforced unconditionally"
        >
          <p className="mt-4 text-meta text-slate-lit">
            The size caps read nothing but the parameters of the trade and the
            contract&rsquo;s own storage. No price, no balance, no external call.
            So if the Validator&rsquo;s signing key is stolen and it signs a
            receipt for a trade far outside the mandate, the signature gets the
            trade as far as the swap and the size cap still reverts it.
          </p>
          <div className="mt-10 flex-1 space-y-9">
            {held.length > 0 ? (
              held.map((c) => <CovenantGauge key={c.key} status={c} />)
            ) : (
              <p className="text-meta text-slate-lit">
                No size covenant could be read from the policy contract.
              </p>
            )}
          </div>
        </Panel>

        <Panel
          tone="observed"
          where="Runs after the swap, on the vault's own report"
          title="Detected, then frozen"
        >
          <p className="mt-4 text-meta text-slate-lit">
            The weight covenants are ratios against net asset value, so computing
            them needs a price, and the hook is deliberately not allowed to read
            an oracle. The Validator checks them before it will sign, and after
            the trade the vault reports its own portfolio on-chain. A breach does
            not revert: refusing the report would leave the fund in breach
            <em> and</em> unrecorded. It freezes the share class instead.
          </p>
          <div className="mt-10 flex-1 space-y-9">
            {observed.length > 0 ? (
              observed.map((c) => <CovenantGauge key={c.key} status={c} />)
            ) : (
              <p className="text-meta text-slate-lit">
                No weight covenant could be read from the policy contract.
              </p>
            )}
          </div>
        </Panel>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-x-8 gap-y-6 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <SourceNote live={live} note={note} subject="These covenant readings" />
        </div>
        <p className="text-meta text-slate-lit lg:col-span-5 lg:col-start-8">
          Detection defends against a compromised manager, which can only ask the
          vault to trade and cannot make it misreport its own balances. It does
          not defend against a compromised vault owner. The size covenants are the
          ones that hold regardless, and that is the whole of the claim.{" "}
          <Link href="/journal" className="link text-brass">
            Read the journal
          </Link>
          .
        </p>
      </div>
    </Shell>
  );
}
