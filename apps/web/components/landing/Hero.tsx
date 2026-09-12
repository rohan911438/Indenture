"use client";

import Link from "next/link";
import { useRef } from "react";
import { SealStage } from "@/components/seal/SealStage";
import { useChoreography } from "@/components/motion/gsap";
import { Figure } from "@/components/ui/Figure";
import { Rule } from "@/components/ui/Rule";
import { Shell } from "@/components/ui/Shell";
import { SourceMark } from "@/components/ui/SourceNote";
import type { SealState } from "@/components/seal/rosette";

/**
 * The opening. Three things and nothing else: the claim, the seal that is
 * reporting the fund's real headroom, and the count of times the claim has
 * actually held.
 *
 * The seal is cropped by the right edge on purpose — a certificate's engraving
 * runs off the page, and a neatly centred medallion would read as a logo.
 *
 * This is the site's one page-load sequence, and it is one timeline: the
 * headline is set line by line, then the lede, the counters and the invitation
 * follow it up. Everything else on the site moves only when the reader does.
 */
export function Hero({
  sealState,
  refusals,
  breaches,
  approved,
  nav,
  navLive,
  navNote,
  journalLive,
  journalNote,
  instrument,
}: {
  sealState: SealState;
  refusals: number;
  breaches: number;
  approved: number;
  nav: string;
  /** the share class is a separate source from the journal, and says so */
  navLive: boolean;
  navNote?: string;
  journalLive: boolean;
  journalNote?: string;
  /** the fund's own identity, so the claim above is attached to something */
  instrument: { label: string; value: string }[];
}) {
  const root = useRef<HTMLElement>(null);
  const stopped = refusals + breaches;

  useChoreography(root, ({ gsap, SplitText, q }) => {
    const tl = gsap.timeline();

    // Registered FIRST, deliberately. These elements are hidden before paint,
    // so the tween that shows them again must not sit downstream of anything
    // that can fail — splitting the headline strands them if it throws.
    //
    // `from` rather than `to`: one tween owns both ends, so the resting state
    // is the element's own visible CSS. A reverted or re-run timeline leaves
    // the hero readable instead of blank.
    const rest = q("[data-reveal]:not([data-split])");
    tl.from(
      rest,
      {
        opacity: 0,
        y: 14,
        duration: 0.75,
        ease: "power2.out",
        stagger: 0.11,
        // Apply the start state at build time, not when the playhead reaches
        // 0.5s. The CSS class has these hidden until the class is dropped a
        // moment later, so without this they pop in fully lit and only then
        // begin their tween.
        immediateRender: true,
      },
      0.5,
    );

    const headline = q("[data-split]")[0];
    if (headline) {
      // the headline is hidden as a block; its lines carry the motion
      gsap.set(headline, { opacity: 1 });
      try {
        SplitText.create(headline, {
          type: "lines",
          mask: "lines",
          autoSplit: true,
          onSplit: (self) =>
            tl.from(
              self.lines,
              { yPercent: 112, duration: 1.1, ease: "power3.out", stagger: 0.1 },
              0,
            ),
        });
      } catch {
        // the headline is already visible; it simply does not set line by line
      }
    }
  });

  const sealTitle = sealState.label
    ? `The fund's seal. Its engraving tightens with the fund's covenant headroom; the covenant closest to its limit is ${sealState.label}, at ${Math.round(sealState.stress * 100)} percent of it.`
    : "The fund's seal, engraved from its covenant headroom.";

  return (
    <section
      ref={root}
      className="relative overflow-hidden pb-movement pt-14 lg:pt-20"
    >
      {/* the well the seal is pressed into, reaching in behind the type */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(58% 72% at 79% 44%, rgba(11,14,18,0.92) 0%, rgba(20,24,29,0) 70%)",
        }}
      />

      <Shell className="relative">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-8">
          <div className="order-2 lg:order-1 lg:col-span-7">
            <h1 data-reveal data-split className="display relief text-signal">
              The manager can be compromised. The mandate cannot.
            </h1>

            <Rule weight="covenant" className="mt-8 w-24" />

            <p data-reveal className="lede mt-7 text-slate-lit">
              Indenture is a fund on Hedera run by an AI manager that nobody
              trusts, including us. Every trade it proposes is re-derived from
              source by an independent Validator before a signature exists, and
              the size covenants hold on-chain even if that Validator&rsquo;s own
              key is stolen. What you can watch here is the refusing.
            </p>

            <div
              data-reveal
              className="mt-10 flex flex-wrap items-start gap-x-10 gap-y-6 sm:gap-x-12"
            >
              {/* A headline "0 trades refused" argues against the headline. When
                  the journal is genuinely empty the honest version is also the
                  stronger one: say so, and make it the invitation. */}
              {stopped > 0 && (
                <>
                  <Figure
                    value={refusals.toLocaleString("en-US")}
                    label={refusals === 1 ? "trade refused" : "trades refused"}
                    tone="refusal"
                    size="lg"
                  />
                  {breaches > 0 && (
                    <Figure
                      value={breaches.toLocaleString("en-US")}
                      label={breaches === 1 ? "breach caught" : "breaches caught"}
                      tone="refusal"
                      size="lg"
                    />
                  )}
                </>
              )}
              <Figure
                value={approved.toLocaleString("en-US")}
                label={approved === 1 ? "trade signed" : "trades signed"}
                tone="brass"
                size="lg"
              />
              {/* NAV comes from the share class, which is not deployed yet, so
                  it carries its own label rather than borrowing the journal's. */}
              <Figure
                value={nav}
                label="net asset value"
                size="lg"
                note={navLive ? undefined : navNote}
              />
            </div>

            <div data-reveal className="mt-5">
              {stopped > 0 ? (
                <SourceMark live={journalLive} note={journalNote} />
              ) : (
                <p className="prose-measure font-sans text-meta text-slate-lit">
                  <span className="text-oxblood-lit">
                    Nothing has been refused on this journal yet.
                  </span>{" "}
                  The manager has not proposed anything outside the mandate since
                  the fund was deployed, so the wall is empty. The first entry on
                  it can be yours.
                </p>
              )}
            </div>

            <div data-reveal className="mt-9">
              <Link href="/blocked" className="link font-sans text-lede text-brass">
                Fire an attack at it yourself
              </Link>
            </div>
          </div>

          {/* Cols 8-12, overflowing the right edge. body has overflow-x hidden,
              so the crop is the layout rather than a scrollbar. */}
          <div className="order-1 lg:order-2 lg:col-span-5">
            <SealStage
              state={sealState}
              title={sealTitle}
              className="mx-auto w-[78%] max-w-[30rem] sm:w-[58%] lg:mx-0 lg:w-[126%] lg:max-w-none"
            />
          </div>
        </div>

        {/* The instrument itself. A claim this large should be standing on a
            real vault address and a real topic, not floating above them. */}
        <dl
          data-reveal
          className="mt-16 grid grid-cols-2 gap-x-8 gap-y-6 border-t border-hairline pt-8 sm:grid-cols-4"
        >
          {instrument.map((f) => (
            <div key={f.label} className="min-w-0">
              <dt className="font-sans text-micro text-slate">{f.label}</dt>
              <dd className="data mt-1.5 truncate text-data text-slate-lit" title={f.value}>
                {f.value}
              </dd>
            </div>
          ))}
        </dl>
      </Shell>
    </section>
  );
}
