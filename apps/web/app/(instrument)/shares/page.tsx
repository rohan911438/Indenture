import { SharesPanel } from "@/components/SharesPanel";
import { SplitLines } from "@/components/motion/SplitLines";
import { Rule } from "@/components/ui/Rule";
import { Shell } from "@/components/ui/Shell";
import { SourceNote } from "@/components/ui/SourceNote";
import { Tag } from "@/components/ui/Tag";
import { getSharesState } from "@/lib/data";
import { sharesFromUnits6 } from "@/lib/format";

export const revalidate = 5;

/**
 * The ERC-3643 share class. Supply, holders, and — the point of the page —
 * whether a given wallet can subscribe, with the exact refusal reason when it
 * cannot. A portfolio breach freezes the whole class.
 */
export default async function SharesPage() {
  const shares = await getSharesState();
  const state = shares.data;
  const { shareClass } = state;
  const supply = sharesFromUnits6(shareClass.totalSupply);

  return (
    <Shell className="py-16 lg:py-24">
      <div className="grid grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <SplitLines as="h1" className="heading max-w-[22ch] text-signal">
            {`${shareClass.name} is a security token. Transfers need a verified identity, and a mandate breach freezes the class.`}
          </SplitLines>
          <p className="prose-measure mt-7 text-slate-lit">
            Compliance is a property of the token under the ERC-3643 standard,
            not a rule this site applies on top of it. A wallet that cannot hold
            these shares is refused by the contract, and the reason below is the
            one the contract would give.
          </p>
        </div>

        <div className="lg:col-span-5 lg:pt-3">
          <SourceNote
            live={shares.live}
            note={shares.note}
            subject="These share-class figures"
          />
        </div>
      </div>

      {/* --- the class ---------------------------------------------------- */}
      <section className="mt-16">
        <Rule weight={shareClass.frozen ? "refusal" : "covenant"} />
        <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
          <div>
            <dt className="font-sans text-micro text-slate">Shares in issue</dt>
            <dd className="data mt-2 text-[1.5rem] leading-none text-signal">
              {supply.toLocaleString("en-US")}
            </dd>
          </div>
          <div>
            <dt className="font-sans text-micro text-slate">Holders</dt>
            {/* ERC-3643 exposes no holder count; an em dash beats a guess. */}
            <dd className="data mt-2 text-[1.5rem] leading-none text-signal">
              {shareClass.holders ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="font-sans text-micro text-slate">
              Net asset value per share
            </dt>
            <dd className="data mt-2 text-[1.5rem] leading-none text-signal">
              ${Number(shareClass.navPerShare).toFixed(4)}
            </dd>
          </div>
          <div>
            <dt className="font-sans text-micro text-slate">Status</dt>
            <dd className="mt-2">
              <Tag tone={shareClass.frozen ? "refused" : "approved"}>
                {shareClass.frozen ? "frozen" : "open"}
              </Tag>
            </dd>
          </div>
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <dt className="font-sans text-micro text-slate">Token</dt>
            <dd className="data mt-2 break-all text-data text-slate-lit">
              {shareClass.token || "not deployed"}
            </dd>
          </div>
        </dl>

        {shareClass.frozen && (
          <p className="prose-measure mt-8 border-l-2 border-oxblood-edge pl-5 font-serif text-[1.0625rem] leading-relaxed text-signal">
            {shareClass.frozenReason ??
              "The portfolio is in breach of a covenant, so no transfer will settle until it is back in bounds."}
          </p>
        )}
      </section>

      <div className="mt-movement">
        <SharesPanel state={state} />
      </div>
    </Shell>
  );
}
