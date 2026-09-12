"use client";

import { useRef } from "react";
import { useChoreography } from "@/components/motion/gsap";
import { SealMark } from "@/components/ui/Wordmark";
import { Shell } from "@/components/ui/Shell";
import { ExternalLink } from "@/components/ui/ExternalLink";

/**
 * The certificate itself, printed on stock.
 *
 * `--bone` has been in the frozen palette from the start and was used nowhere.
 * One full-width band of it, mid-page, is the single strongest move available
 * inside the existing colours: it breaks an otherwise unrelieved dark site, and
 * it gives the instrument a physical form — this is the page of the deed that
 * names the thing and states its terms.
 *
 * The whole palette inverts here. Ink is the text, brass-dim is the secondary,
 * oxblood is the refusal, and every one of those clears 5:1 on bone. The edges
 * are hard brass rules rather than a gradient fade, because a printed band has
 * a cut edge.
 */
export interface CertificateFacts {
  className: string;
  token: string;
  vault: string;
  mandateHash: string;
  mandateSeq: number;
  mandateTopic: string;
  terms: string;
  supply: string;
  navPerShare: string;
  refusals: number;
  approved: number;
  breaches: number;
  frozen: boolean;
  frozenReason: string | null;
  /** the honest label for the share-class figures specifically */
  sharesLive: boolean;
  sharesNote?: string;
  mandateLive: boolean;
}

function Entry({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="font-sans text-micro text-brass-dim">{label}</dt>
      <dd className="data mt-1 break-all text-data text-ink">{children}</dd>
    </div>
  );
}

export function CertificateBand({ facts }: { facts: CertificateFacts }) {
  const root = useRef<HTMLElement>(null);

  useChoreography(root, ({ gsap, q }) => {
    // The band drifts against the page, the way a sheet laid on a desk does.
    // One tween, no fades — the content is already visible.
    const inner = q("[data-drift]")[0];
    if (!inner) return;
    gsap.fromTo(
      inner,
      { y: -18 },
      {
        y: 18,
        ease: "none",
        scrollTrigger: {
          trigger: root.current,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
          invalidateOnRefresh: true,
        },
      },
    );
    // gsap.matchMedia reverts this tween and kills its ScrollTrigger on
    // teardown, so there is nothing to unwind by hand.
  });

  return (
    <section ref={root} className="on-bone relative my-movement overflow-hidden">
      <div aria-hidden className="h-0.5 bg-brass" />
      <div aria-hidden className="h-px bg-brass-dim" />

      <div data-drift className="ruled py-16 sm:py-20">
        <Shell>
          <div className="grid grid-cols-1 gap-x-8 gap-y-12 lg:grid-cols-12">
            {/* --- the instrument ---------------------------------------- */}
            <div className="lg:col-span-7">
              <div className="flex items-center gap-3">
                <SealMark size={26} />
                <p className="font-sans text-micro text-brass-dim">
                  Indenture Fund One, an ERC-3643 share class on Hedera
                </p>
              </div>

              <h2 className="mt-6 font-serif text-[clamp(1.75rem,3vw,2.5rem)] leading-tight text-ink">
                {facts.className}
              </h2>

              <p className="mt-7 max-w-[54ch] font-serif text-[clamp(1.0625rem,1.5vw,1.25rem)] leading-[1.6] text-ink">
                {facts.terms}
              </p>

              <p className="mt-6 max-w-[62ch] font-sans text-data text-brass-dim">
                Those figures are the compiled covenant values from the mandate
                published at the sequence below. The Validator re-reads them from
                that topic on every decision, so this is the text the refusals
                are measured against, not a restatement of it.
                {!facts.mandateLive && (
                  <span className="text-oxblood">
                    {" "}
                    The mandate could not be read live, so these are sample
                    values.
                  </span>
                )}
              </p>

              {facts.frozen && (
                <p className="mt-7 border-l-2 border-oxblood pl-4 font-sans text-meta text-oxblood">
                  This class is frozen.{" "}
                  {facts.frozenReason ?? "The portfolio is in breach of a covenant."}
                </p>
              )}
            </div>

            {/* --- the register ----------------------------------------- */}
            <dl className="grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:gap-x-8 lg:col-span-5 lg:grid-cols-1">
              <Entry label="Vault">{facts.vault}</Entry>
              <Entry label="Mandate">{facts.mandateHash}</Entry>
              <Entry label="Issued at sequence">
                <ExternalLink
                  href={`https://hashscan.io/testnet/topic/${facts.mandateTopic || "0.0.0"}/message/${facts.mandateSeq}`}
                  className="text-ink"
                >
                  {facts.mandateSeq}
                </ExternalLink>
              </Entry>

              <div className="sm:col-span-2 lg:col-span-1">
                <div aria-hidden className="mb-6 h-px bg-hairline-bone" />
                <div className="grid grid-cols-3 gap-x-4">
                  <div>
                    <div className="data text-[1.5rem] leading-none text-oxblood">
                      {facts.refusals.toLocaleString("en-US")}
                    </div>
                    <div className="mt-1.5 font-sans text-micro text-brass-dim">
                      refused
                    </div>
                  </div>
                  <div>
                    <div className="data text-[1.5rem] leading-none text-oxblood">
                      {facts.breaches.toLocaleString("en-US")}
                    </div>
                    <div className="mt-1.5 font-sans text-micro text-brass-dim">
                      breaches
                    </div>
                  </div>
                  <div>
                    <div className="data text-[1.5rem] leading-none text-ink">
                      {facts.approved.toLocaleString("en-US")}
                    </div>
                    <div className="mt-1.5 font-sans text-micro text-brass-dim">
                      signed
                    </div>
                  </div>
                </div>
              </div>

              <div className="sm:col-span-2 lg:col-span-1">
                <div aria-hidden className="mb-6 h-px bg-hairline-bone" />
                <Entry label="Shares in issue">{facts.supply}</Entry>
                <div className="mt-5">
                  <Entry label="Net asset value per share">
                    {facts.navPerShare}
                  </Entry>
                </div>
                <p className="mt-4 font-sans text-micro text-oxblood">
                  {facts.sharesLive
                    ? null
                    : `Share-class figures are sample data — ${facts.sharesNote ?? "no live source available"}.`}
                </p>
              </div>
            </dl>
          </div>
        </Shell>
      </div>

      <div aria-hidden className="h-px bg-brass-dim" />
      <div aria-hidden className="h-0.5 bg-brass" />
    </section>
  );
}
