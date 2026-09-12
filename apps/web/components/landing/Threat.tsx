import Link from "next/link";
import { Rule } from "@/components/ui/Rule";
import { Shell } from "@/components/ui/Shell";
import { Tag } from "@/components/ui/Tag";
import type { AttackScenario } from "@/lib/data";

/**
 * The threat, stated once and then shown three times.
 *
 * The argument is deliberately short — two paragraphs — because the evidence
 * carries it. Every specimen below is a real string from
 * mocks/attack-scenarios.json, the exact text the console on /blocked fires at
 * the deployed Validator, so the thing being described and the thing being
 * demonstrated are the same bytes.
 *
 * Set as specimens on raised stock rather than as prose: this section has a
 * different shape from the ones around it because it is doing a different job,
 * and a page where every movement is a heading over two columns of text is a
 * document, not a prospectus.
 */
export function Threat({ specimens }: { specimens: AttackScenario[] }) {
  return (
    <Shell as="section" className="py-movement">
      <div className="grid grid-cols-1 gap-x-8 gap-y-8 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <h2 className="heading text-signal">
            What a compromised manager actually does
          </h2>
        </div>
        <div className="lg:col-span-5 lg:col-start-8">
          <p className="text-slate-lit">
            An AI fund manager has to read things. Market commentary, the output
            of its own tools, a field in the transaction it was asked to
            evaluate. Anything it reads, somebody can write.
          </p>
          <p className="mt-5 text-signal">
            So the attack worth defending against is not a stolen key. It is a
            sentence — and in most systems built this way, the model&rsquo;s
            judgement is the only thing standing between that sentence and the
            money.
          </p>
        </div>
      </div>

      {/* --- the specimens --------------------------------------------- */}
      <div className="mt-16 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
        <h3 className="subheading text-signal">
          Three sentences somebody can write
        </h3>
        <p className="font-sans text-data text-slate-lit">
          The exact strings the console fires, and the covenant each one is
          reaching for
        </p>
      </div>
      <Rule className="mt-5" />

      <ul className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        {specimens.map((s) => (
          <li
            key={s.id}
            className="flex flex-col border border-hairline bg-ink-raised/40"
          >
            <div aria-hidden className="h-0.5 bg-oxblood-edge" />
            <div className="flex flex-1 flex-col p-6">
              {/* a flex column stretches its children; the tag hugs its text */}
              <div>
                <Tag tone="injection">{s.proposer}</Tag>
              </div>
              <blockquote className="mt-5 flex-1">
                <p className="break-words font-serif text-[1.0625rem] italic leading-[1.65] text-signal">
                  &ldquo;{s.injectedReasoning}&rdquo;
                </p>
              </blockquote>
              <div className="mt-6">
                <Rule />
                <p className="mt-4 font-sans text-data text-slate-lit">
                  Reaching for
                </p>
                <p className="data mt-1 break-all text-data text-oxblood-lit">
                  {s.covenant}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-10 grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-12">
        <p className="prose-measure text-slate-lit lg:col-span-7">
          None of them reach the Validator. The reasoning is journaled to Hedera
          as evidence and dropped at the boundary, so the service that decides is
          never handed a field to put a sentence in.
        </p>
        <p className="font-sans text-meta lg:col-span-4 lg:col-start-9">
          <Link href="/blocked" className="link text-brass">
            Fire any of the three yourself
          </Link>
        </p>
      </div>
    </Shell>
  );
}
