import { CovenantGauge } from "@/components/CovenantGauge";
import { MandateHero } from "@/components/MandateHero";
import { ExternalLink } from "@/components/ui/ExternalLink";
import { Rule } from "@/components/ui/Rule";
import { Shell } from "@/components/ui/Shell";
import { SourceNote } from "@/components/ui/SourceNote";
import {
  getCovenantStatus,
  getMandate,
  hashscanTopicMessage,
} from "@/lib/data";

export const revalidate = 5;

/**
 * The deed. The clause the fund is held to, the identity of the document that
 * says it, and the source it was published as.
 *
 * The published YAML is on this page because it is the only artefact on the
 * site that the Validator reads verbatim — everything else here is a rendering
 * of it. A reader who wants to check the site against the chain checks this.
 */
export default async function MandatePage() {
  const [mandateSrc, covenantsSrc] = await Promise.all([
    getMandate(),
    getCovenantStatus(),
  ]);
  const mandate = mandateSrc.data;
  const covenants = covenantsSrc.data;

  return (
    <Shell className="py-16 lg:py-24">
      <div className="grid grid-cols-1 gap-x-8 gap-y-14 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <MandateHero mandate={mandate} />
          <p className="prose-measure mt-8 text-slate-lit">
            Published to the Hedera Consensus Service and re-read from it on
            every decision. The Validator never takes these numbers from the
            proposer, from this site, or from a cached copy.
          </p>
        </div>

        {/* the document's own identity, as a register */}
        <dl className="grid auto-rows-min grid-cols-1 content-start gap-y-6 sm:grid-cols-2 sm:gap-x-8 lg:col-span-5 lg:grid-cols-1 lg:pt-4">
          <div>
            <dt className="font-sans text-micro text-slate">Mandate hash</dt>
            <dd className="data mt-1 break-all text-data text-signal">
              {mandate.mandateHash}
            </dd>
          </div>
          <div>
            <dt className="font-sans text-micro text-slate">Vault</dt>
            <dd className="data mt-1 break-all text-data text-signal">
              {mandate.vault}
            </dd>
          </div>
          <div>
            <dt className="font-sans text-micro text-slate">
              Published at sequence
            </dt>
            <dd className="data mt-1 text-data text-signal">
              <ExternalLink
                href={hashscanTopicMessage(mandate.topicId, mandate.seq)}
              >
                {mandate.seq} on topic {mandate.topicId || "(unset)"}
              </ExternalLink>
            </dd>
          </div>
          <div className="sm:col-span-2 lg:col-span-1">
            <SourceNote
              live={mandateSrc.live}
              note={mandateSrc.note}
              subject="These mandate terms"
            />
          </div>
        </dl>
      </div>

      {/* --- where the fund stands against each clause --------------------- */}
      <section className="mt-movement">
        <h2 className="heading text-signal">Where the fund stands today</h2>
        <p className="prose-measure mt-5 text-slate-lit">
          Limits are read from the policy contract, not from the mandate above.
          Reading both from the same place would hide the one discrepancy that
          matters: a mandate published to Hedera but never amended into the
          policy that enforces it.
        </p>

        <div className="mt-12 grid grid-cols-1 gap-x-16 gap-y-10 sm:grid-cols-2">
          {covenants.map((c) => (
            <CovenantGauge key={c.key} status={c} />
          ))}
        </div>

        <div className="mt-10 max-w-deed">
          <SourceNote
            live={covenantsSrc.live}
            note={covenantsSrc.note}
            subject="These readings"
          />
        </div>
      </section>

      {/* --- the document as published ------------------------------------ */}
      <section className="mt-movement">
        <h2 className="heading text-signal">The document as published</h2>
        <p className="prose-measure mt-5 text-slate-lit">
          Byte for byte, what was written to the mandate topic. The hash above is
          this text. Everything else on this site is a rendering of it.
        </p>
        <Rule className="mt-8" />
        <pre className="data mt-8 overflow-x-auto whitespace-pre text-data leading-[1.8] text-slate-lit">
          <code>{mandate.yaml}</code>
        </pre>
      </section>
    </Shell>
  );
}
