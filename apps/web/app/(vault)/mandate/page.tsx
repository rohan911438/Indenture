import { Suspense } from "react";
import { Gauge } from "@/components/paper/Gauge";
import { Hash } from "@/components/paper/Hash";
import { DemoChip } from "@/components/paper/SealGate";
import { Eyebrow, Rule } from "@/components/paper/Primitives";
import { Reveal } from "@/components/motion/Reveal";
import {
  getCovenantStatus,
  getMandate,
  getMandateHistory,
  hashscanTopicMessage,
  type CovenantStatus,
} from "@/lib/data";
import { MANDATE_TOPIC } from "@/lib/deployments";
import { fmtUtc, pctFromBps, usdFromUnits6 } from "@/lib/format";
import type { CovenantValues } from "@/lib/types";

export const revalidate = 5;

export const metadata = {
  title: "Mandate — Indenture",
  description:
    "The covenants the fund is bound by, and how close it currently sits to each one.",
};

/**
 * The instrument itself, as clauses.
 *
 * Prose in a serif with the clause number out in the margin, because that is
 * what this document is: terms someone agreed to, not settings someone
 * configured. The gauges beside it are the same terms measured against the
 * fund's actual state, which is the only thing that makes the clauses more
 * than a promise.
 */
const CLAUSES: {
  title: string;
  body: (m: CovenantValues) => string;
}[] = [
  {
    title: "Concentration",
    body: (m) =>
      `The Fund may hold no more than ${pctFromBps(m.maxPositionBps)} of net assets in any single position. A proposal that would carry a position past this limit is refused before it reaches the pool, and a position carried past it by a movement in price is recorded as a breach.`,
  },
  {
    title: "Liquidity",
    body: (m) =>
      `The Fund shall keep at least ${pctFromBps(m.minCashBps)} of net assets in the quote currency at all times. This is a floor, not a target: the Manager may not spend it down to fund a position, however attractive that position appears.`,
  },
  {
    title: "Trade size",
    body: (m) =>
      `No single transaction may exceed ${usdFromUnits6(m.maxTradeNotional)} in notional value. The limit is evaluated on the transaction the Validator was asked to sign, not on the transaction that settles, so it cannot be evaded by splitting a trade across a block.`,
  },
  {
    title: "Turnover",
    body: (m) =>
      `The Fund may not transact more than ${usdFromUnits6(m.maxDailyNotional)} in notional value in a single day. The day is the consensus day on Hedera, and the running total is kept on-chain rather than by the Manager.`,
  },
  {
    title: "Authority",
    body: () =>
      `The Manager proposes and never executes. Every proposal is re-derived by an independent Validator from structured inputs it fetches itself — it does not read the Manager's prompt, its reasoning, or any text the Manager was given — and is admitted only under an EIP-712 receipt the hook verifies on-chain. The Manager holds no key that can amend the clauses above.`,
  },
];

/** Both units this fund measures covenants in, printed the same way twice. */
function fmt(c: CovenantStatus, value: number): string {
  return c.unit === "bps" ? pctFromBps(value) : usdFromUnits6(value);
}

function headroomOf(c: CovenantStatus): string {
  const slack = c.mode === "ceiling" ? c.limit - c.current : c.current - c.limit;
  if (slack < 0) return "BREACHED";
  return `${fmt(c, slack)} HEADROOM`;
}

export default async function MandatePage() {
  const [mandateSrc, covenantsSrc, historySrc] = await Promise.all([
    getMandate(),
    getCovenantStatus(),
    getMandateHistory(),
  ]);
  const m = mandateSrc.data;

  return (
    <>
      <section className="shell page-head">
        <div className="page-head__chips">
          <Eyebrow>The mandate</Eyebrow>
          <Suspense fallback={null}>
            <DemoChip seeded={!mandateSrc.live} />
          </Suspense>
        </div>

        <Reveal as="h1" className="t-display-l section__head" start="top 95%">
          Terms the manager cannot amend.
        </Reveal>
      </section>

      <Rule />

      <section className="shell" style={{ paddingBlock: "clamp(48px, 6vw, 96px)" }}>
        <div className="grid gap-x-6 gap-y-16 lg:grid-cols-12">
          <div className="lg:col-span-7">
            {CLAUSES.map((clause, i) => (
              <article key={clause.title} className="clause">
                <span className="clause__n t-data">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h2 className="t-title">{clause.title}</h2>
                  <p className="t-prose" style={{ marginTop: 16, color: "var(--ink-2)" }}>
                    {clause.body(m)}
                  </p>
                </div>
              </article>
            ))}
          </div>

          <aside className="lg:col-span-4 lg:col-start-9">
            <div className="sticky-rail">
              <div>
                <Eyebrow>Headroom</Eyebrow>
                <div className="mt-8 flex flex-col gap-8">
                  {covenantsSrc.data.map((c) => (
                    <Gauge
                      key={c.key}
                      label={c.label}
                      current={c.current}
                      limit={c.limit}
                      mode={c.mode}
                      format={{
                        current: fmt(c, c.current),
                        limit: fmt(c, c.limit),
                        headroom: headroomOf(c),
                      }}
                    />
                  ))}
                </div>
                {!covenantsSrc.live && (
                  <p className="t-data-sm" style={{ marginTop: 20, color: "var(--ink-3)" }}>
                    SOURCE · SEEDED
                  </p>
                )}
              </div>

              <div>
                <Eyebrow>This version</Eyebrow>
                <dl className="mt-8 flex flex-col gap-5">
                  <div>
                    <dt className="t-data-sm" style={{ color: "var(--ink-3)" }}>
                      MANDATE HASH
                    </dt>
                    <dd className="mt-2" style={{ margin: 0 }}>
                      <Hash value={m.mandateHash} chars={10} />
                    </dd>
                  </div>
                  <div>
                    <dt className="t-data-sm" style={{ color: "var(--ink-3)" }}>
                      HCS SEQ
                    </dt>
                    <dd className="mt-2 t-data" style={{ margin: 0, color: "var(--ink-2)" }}>
                      <a
                        href={hashscanTopicMessage(m.topicId || MANDATE_TOPIC, m.seq)}
                        target="_blank"
                        rel="noreferrer"
                        data-cursor="OPEN"
                      >
                        #{m.seq} ↗
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt className="t-data-sm" style={{ color: "var(--ink-3)" }}>
                      VAULT
                    </dt>
                    <dd className="mt-2" style={{ margin: 0 }}>
                      <Hash value={m.vault} chars={10} />
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <Rule />

      <section className="shell section">
        <Eyebrow className="section__eyebrow">Amendment history</Eyebrow>
        <Reveal as="h2" className="t-display-m section__head" start="top 88%">
          Every version, and what moved.
        </Reveal>

        <div className="mt-0">
          {historySrc.data.map((a, i) => {
            const prev = historySrc.data[i + 1];
            return (
              <article key={a.mandateHash} className="clause">
                <span className="clause__n t-data">#{a.seq}</span>
                <div>
                  <div className="flex flex-wrap items-baseline justify-between gap-4">
                    <h3 className="t-title">
                      {a.action === "ADOPTED" ? "Adopted" : "Amended"}
                    </h3>
                    <span className="t-data-sm" style={{ color: "var(--ink-3)" }}>
                      {fmtUtc(a.ts)}
                    </span>
                  </div>
                  <p className="t-data" style={{ marginTop: 12, color: "var(--ink-2)" }}>
                    {prev ? diffLine(prev.covenants, a.covenants) : "Initial covenants set."}
                  </p>
                  <p className="t-data-sm" style={{ marginTop: 10, color: "var(--ink-3)" }}>
                    {a.mandateHash.slice(0, 14)}…
                    {a.prevMandateHash && ` · replaces ${a.prevMandateHash.slice(0, 10)}…`}
                  </p>
                </div>
              </article>
            );
          })}
        </div>

        {!historySrc.live && historySrc.note && (
          <p className="t-data-sm" style={{ marginTop: 32, color: "var(--ink-3)" }}>
            SOURCE · SEEDED — {historySrc.note.toUpperCase()}
          </p>
        )}
      </section>
    </>
  );
}

/**
 * One line naming exactly what changed between two published covenant sets.
 *
 * A version list that does not say what moved is a list of hashes, and nobody
 * reads a list of hashes.
 */
function diffLine(before: CovenantValues, after: CovenantValues): string {
  const parts: string[] = [];
  const bps = (k: "maxPositionBps" | "minCashBps", name: string) => {
    if (before[k] !== after[k]) {
      parts.push(`${name} ${pctFromBps(before[k])} → ${pctFromBps(after[k])}`);
    }
  };
  const usd = (k: "maxTradeNotional" | "maxDailyNotional", name: string) => {
    if (before[k] !== after[k]) {
      parts.push(`${name} ${usdFromUnits6(before[k])} → ${usdFromUnits6(after[k])}`);
    }
  };
  bps("maxPositionBps", "concentration");
  bps("minCashBps", "liquidity floor");
  usd("maxTradeNotional", "trade size");
  usd("maxDailyNotional", "turnover");
  return parts.length ? parts.join(" · ") : "No covenant values changed.";
}
