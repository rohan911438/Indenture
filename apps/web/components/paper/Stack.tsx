import { Reveal } from "@/components/motion/Reveal";
import { Rise } from "@/components/motion/Rise";
import { Counter } from "@/components/motion/Counter";
import { Eyebrow, Metric, Rule, Triptych, TriptychCell } from "./Primitives";
import { deployments, MANDATE_TOPIC } from "@/lib/deployments";

const HASHSCAN = "https://hashscan.io/testnet";
const REPO = "https://github.com/rohan911438/Indenture";

const ROLES = [
  {
    name: "Hedera",
    role: "the register",
    body: "The identity registry and the journal. Every decision the fund makes is written to a consensus topic before it is anyone's word against anyone's.",
  },
  {
    name: "Uniswap v4",
    role: "the trustee",
    body: "The hook is where the refusal happens. Not a wrapper around the pool, not a guard in front of it — inside beforeSwap, where the swap either clears or does not.",
  },
  {
    name: "Chainlink",
    role: "the author",
    body: "Prices the validator re-derives its decision from, fetched independently. The manager never supplies the numbers it is judged against.",
  },
];

/**
 * The stack, and what each part of it is for.
 *
 * Hard numbers, and every link real. A dead link in this section is worse than
 * no link: it is the one place a judge goes to check whether any of this is
 * actually deployed.
 */
export function Stack() {
  const hook = deployments.contracts?.PolicyHook ?? "";
  const journalTopic = deployments.hcs?.journalTopicId ?? "";

  return (
    <>
      <Rule />
      <section className="section" aria-labelledby="stack-head">
        <div className="shell">
          <Eyebrow className="section__eyebrow">The stack</Eyebrow>

          <Reveal as="h2" id="stack-head" className="t-display-l section__head">
            Three pieces, each doing one job.
          </Reveal>

          <Rise>
            <Triptych>
              {ROLES.map((r) => (
                <TriptychCell key={r.name}>
                  {/* The role always takes its own line, so the three cells
                      break at the same place and their bodies start level. */}
                  <h3 className="t-display-m">
                    {r.name}
                    <span style={{ display: "block", color: "var(--ink-3)" }}>
                      — {r.role}
                    </span>
                  </h3>
                  <p className="t-small mt-8" style={{ color: "var(--ink-2)" }}>
                    {r.body}
                  </p>
                </TriptychCell>
              ))}
            </Triptych>
          </Rise>

          <Rise className="mt-24 grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              value={<Counter value={3} suffix="s" />}
              caption="finality, Hedera consensus"
            />
            <Metric value="$0.0008" caption="per journal entry" />
            <Metric
              value={<Counter value={296} />}
              caption="chain id, Hedera testnet"
            />
            <Metric
              value={<Counter value={35} prefix="~" suffix="k" />}
              caption="gas overhead per swap"
            />
          </Rise>

          <div
            className="t-data-sm mt-24 flex flex-wrap gap-x-10 gap-y-4"
            style={{ color: "var(--ink-3)" }}
          >
            <a
              className="nav__link t-data-sm"
              href={`${HASHSCAN}/contract/${hook}`}
              target="_blank"
              rel="noreferrer"
              data-cursor="OPEN"
            >
              CONTRACTS ↗ HASHSCAN
            </a>
            <a
              className="nav__link t-data-sm"
              href={`${HASHSCAN}/topic/${journalTopic}`}
              target="_blank"
              rel="noreferrer"
              data-cursor="OPEN"
            >
              JOURNAL TOPIC {journalTopic} ↗
            </a>
            <a
              className="nav__link t-data-sm"
              href={`${HASHSCAN}/topic/${MANDATE_TOPIC}`}
              target="_blank"
              rel="noreferrer"
              data-cursor="OPEN"
            >
              MANDATE TOPIC {MANDATE_TOPIC} ↗
            </a>
            <a
              className="nav__link t-data-sm"
              href={REPO}
              target="_blank"
              rel="noreferrer"
              data-cursor="OPEN"
            >
              REPO ↗
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
