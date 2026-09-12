import Link from "next/link";
import { SealMark } from "@/components/ui/Wordmark";
import { Shell } from "@/components/ui/Shell";
import { Rule } from "@/components/ui/Rule";

/**
 * The close, as a deed's execution page.
 *
 * A real indenture ends by naming the parties that executed it and the seals
 * they executed it under. So does this one, and the parties are real addresses
 * from contracts/deployments.json rather than a marketing sign-off. It is the
 * concept's natural ending and it puts the fund's actual identity — network,
 * chain, the key that signs receipts — at the foot of the argument that
 * depends on them.
 */
export interface Party {
  role: string;
  address: string;
  note: string;
}

export function Close({
  validatorLive,
  network,
  chainId,
  parties,
}: {
  validatorLive: boolean;
  network: string;
  chainId: number;
  parties: Party[];
}) {
  return (
    <Shell as="section" className="pb-movement pt-movement">
      <Rule weight="covenant" />

      <div className="mt-12 grid grid-cols-1 gap-x-8 gap-y-12 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div className="flex items-center gap-3">
            <SealMark size={28} />
            <p className="font-sans text-micro text-brass">
              Executed on {network}, chain {chainId}
            </p>
          </div>

          <p className="mt-8 font-serif text-[clamp(1.5rem,3vw,2.25rem)] italic leading-[1.25] text-signal">
            The proof is not that the fund performs. It is that a fully
            compromised manager, or a compromised Validator signature, still
            cannot move a dollar outside this mandate.
          </p>

          <p className="prose-measure mt-8 text-slate-lit">
            {validatorLive
              ? "The Validator is deployed and answering. Pick an injection, send it, and read the refusal it gives back."
              : "No Validator is answering right now, so the console will run the same sequence as a rehearsal and tell you that is what it did."}
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3">
            <Link
              href="/blocked"
              className="border-b-2 border-oxblood-edge pb-1 font-sans text-lede text-signal transition-colors duration-150 hover:border-oxblood-lit hover:text-oxblood-lit"
            >
              Try to break it
            </Link>
            <Link
              href="/mandate"
              className="link font-sans text-meta text-slate-lit"
            >
              Read the mandate it is measured against
            </Link>
          </div>
        </div>

        {/* the parties, as a deed names them */}
        <dl className="lg:col-span-4 lg:col-start-9">
          <p className="font-sans text-micro text-slate">The parties</p>
          <div className="mt-5 divide-y divide-hairline border-y border-hairline">
            {parties.map((p) => (
              <div key={p.role} className="py-4">
                <dt className="font-sans text-meta text-signal">{p.role}</dt>
                <dd className="data mt-1.5 break-all text-data text-slate-lit">
                  {p.address}
                </dd>
                <dd className="mt-1.5 font-sans text-micro text-slate-lit">
                  {p.note}
                </dd>
              </div>
            ))}
          </div>
        </dl>
      </div>
    </Shell>
  );
}
