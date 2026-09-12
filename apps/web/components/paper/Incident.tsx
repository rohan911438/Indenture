import { Reveal } from "@/components/motion/Reveal";
import { Rise } from "@/components/motion/Rise";
import { Counter } from "@/components/motion/Counter";
import { Eyebrow, Metric, Rule, Triptych, TriptychCell } from "./Primitives";

/**
 * The incident. Everything from here to the footer is paper.
 *
 * The figures are Blockaid's H1 2026 numbers and the incident is the reported
 * May 2026 Grok drain, named. The section exists to establish one sentence:
 * the losses are not a filtering failure, they are the absence of anything
 * that looks at decisions.
 */
export function Incident() {
  return (
    <>
      <Rule />
      <section className="section" aria-labelledby="incident-head">
        <div className="shell">
          <Eyebrow className="section__eyebrow">May 2026</Eyebrow>

          <Reveal as="h2" id="incident-head" className="t-display-l section__head">
            Nothing in the stack could tell a decision from an injection.
          </Reveal>

          <div className="grid gap-x-6 gap-y-24 lg:grid-cols-12">
            <Reveal
              as="div"
              className="lg:col-span-7"
              start="top 85%"
              duration={1.1}
              stagger={0.05}
            >
              <p className="t-prose" style={{ color: "var(--ink-2)" }}>
                In May 2026 an attacker drained roughly $150,000 from an
                AI-controlled wallet by asking Grok to translate a Morse code
                message. The decoded text was a transfer instruction. Content
                filters saw Morse. Spend limits had already been escalated away
                by an NFT the agent accepted. Nothing in the stack could tell a
                decision from an injection, because nothing was looking at
                decisions.
              </p>
            </Reveal>

            <div className="lg:col-span-12">
              <Rise>
                <Triptych>
                  <TriptychCell>
                    <Metric
                      value={
                        <Counter value={1100} divisor={1000} decimals={1} prefix="$" suffix="B" />
                      }
                      caption="stolen across on-chain AI exploits, H1 2026"
                    />
                  </TriptychCell>
                  <TriptychCell>
                    <Metric
                      value={<Counter value={34} divisor={10} decimals={1} suffix="×" />}
                      caption="all of 2025, in six months"
                    />
                  </TriptychCell>
                  <TriptychCell>
                    <Metric
                      value={<Counter value={216} prefix="$" suffix="k" />}
                      caption="the Bankr injection, single incident"
                    />
                  </TriptychCell>
                </Triptych>
              </Rise>

              <p
                className="t-data-sm mt-6 text-right"
                style={{ color: "var(--ink-3)" }}
              >
                SOURCE · BLOCKAID, H1 2026 · 212 EXPLOITS
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
