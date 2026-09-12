import { Reveal } from "@/components/motion/Reveal";
import { Typewriter } from "@/components/motion/Typewriter";
import { Eyebrow, Panel, Rule } from "./Primitives";

/**
 * Two refusals, one hook.
 *
 * The revert strings are the headline here — they are what a judge will
 * remember, and they are set in mono because that is what they actually are:
 * a named reason a transaction did not happen.
 *
 * Both type on, 0.3s apart, and that is the whole entrance for this section.
 */
const REFUSALS = [
  {
    revert: 'IdentityNotVerified',
    delay: 0,
    lines: [
      "Refused: a buyer whose wallet is not in the ERC-3643 identity registry.",
      "Checked inside beforeSwap, before the pool prices anything at all.",
      "A permissionless pool cannot know its counterparty. This one asks.",
    ],
  },
  {
    revert: 'CovenantBreach("max_position_pct")',
    delay: 0.3,
    lines: [
      "Refused: the fund's own manager, proposing a position over the ceiling.",
      "Evaluated against covenants the manager holds no key to amend.",
      "The validator signed nothing, so the hook had nothing to honour.",
    ],
  },
];

export function Refusals() {
  return (
    <>
      <Rule />
      <section className="section" aria-labelledby="refusals-head">
        <div className="shell">
          <Eyebrow className="section__eyebrow">One hook, two policies</Eyebrow>

          <Reveal as="h2" id="refusals-head" className="t-display-l section__head">
            Two things a pool has never been able to refuse.
          </Reveal>

          <div className="grid gap-6 lg:grid-cols-2">
            {REFUSALS.map((r) => (
              <Panel key={r.revert} className="p-10">
                <p
                  className="t-data"
                  style={{
                    fontSize: "clamp(18px, 1.8vw, 28px)",
                    lineHeight: 1.25,
                    color: "var(--refuse)",
                    overflowWrap: "anywhere",
                  }}
                >
                  <Typewriter text={r.revert} delay={r.delay} />
                </p>

                <ul className="mt-10 flex flex-col gap-3">
                  {r.lines.map((line) => (
                    <li
                      key={line}
                      className="t-small"
                      style={{ color: "var(--ink-2)", listStyle: "none" }}
                    >
                      {line}
                    </li>
                  ))}
                </ul>
              </Panel>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
