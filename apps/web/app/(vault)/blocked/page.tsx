import { Suspense } from "react";
import { BlockedEntry } from "@/components/paper/BlockedEntry";
import { DemoChip } from "@/components/paper/SealGate";
import { Eyebrow, Rule } from "@/components/paper/Primitives";
import { Counter } from "@/components/motion/Counter";
import { getBlocked, hashscanTopicMessage, JOURNAL_TOPIC_ID } from "@/lib/data";
import { fmtUtc, usdFromUnits6 } from "@/lib/format";
import type { BreachBody, JournalRow, ReceiptBody } from "@/lib/types";

export const revalidate = 5;

export const metadata = {
  title: "Blocked — Indenture",
  description:
    "Every attempt the hook refused, and the exact prompt the manager was looking at when it tried.",
};

/** The covenant is the first field of the reason string, by convention. */
function covenantOf(row: JournalRow): string {
  if (row.type === "BREACH") return (row.body as BreachBody).covenant;
  const reason = (row.body as ReceiptBody).reason ?? "";
  return reason.includes(":") ? reason.slice(0, reason.indexOf(":")) : reason;
}

function reasonOf(row: JournalRow): string {
  if (row.type === "BREACH") return (row.body as BreachBody).detail;
  return (row.body as ReceiptBody).reason ?? "";
}

/**
 * What the proposal would have done, in money and direction.
 *
 * `amountSpecified` is signed: negative is an exact input. The sign carries no
 * meaning a reader needs, so it is spent here and not shown.
 */
function actionOf(row: JournalRow): string | null {
  const ctx = row.context;
  if (!ctx) return null;
  const raw = ctx.swapParams?.amountSpecified;
  if (!raw) return null;
  const size = usdFromUnits6(raw.replace("-", ""));
  return ctx.swapParams.zeroForOne
    ? `${size} asset → quote`
    : `${size} quote → asset`;
}

export default async function BlockedPage() {
  const src = await getBlocked();
  const rows = src.data;

  return (
    <>
      <section className="shell page-head">
        <div className="page-head__chips">
          <Eyebrow>The wall</Eyebrow>
          <Suspense fallback={null}>
            <DemoChip seeded={!src.live} />
          </Suspense>
        </div>

        {/* Deliberately not wrapped in Reveal: SplitText rewrites the text
            nodes it is given, which would take the counter's element with it. */}
        <h1 style={{ marginTop: 48 }}>
          <span className="t-numeral" style={{ display: "block" }}>
            <Counter value={rows.length} start="top 95%" /> attempts refused.
          </span>
          <span
            className="t-numeral"
            style={{ display: "block", marginTop: 16, color: "var(--permit)" }}
          >
            $0.00 lost.
          </span>
        </h1>

        <p className="t-prose" style={{ marginTop: 48, color: "var(--ink-2)" }}>
          Each entry is a transaction that did not happen. The reason is named,
          it was re-derived from the mandate and the fund&rsquo;s own state
          rather than taken from whoever proposed the trade, and where the
          manager was reasoning from a poisoned context, that text is here in
          full.
        </p>

        {!src.live && src.note && (
          <p className="t-data-sm" style={{ marginTop: 24, color: "var(--ink-3)" }}>
            SOURCE · SEEDED — {src.note.toUpperCase()}
          </p>
        )}
      </section>

      <Rule />

      <section className="shell">
        {rows.length === 0 ? (
          <p className="t-prose" style={{ paddingBlock: 96, color: "var(--ink-2)" }}>
            Nothing has been blocked yet, which is the honest state of a fund
            whose manager has not yet tried anything it should not.
          </p>
        ) : (
          rows.map((row) => (
            <BlockedEntry
              key={`${row.type}-${row.seq}`}
              kind={row.type === "BREACH" ? "breach" : "refused"}
              covenant={covenantOf(row)}
              reason={reasonOf(row)}
              when={fmtUtc(row.ts)}
              seq={row.seq}
              action={actionOf(row)}
              contextHash={
                row.type === "RECEIPT"
                  ? ((row.body as ReceiptBody).paramsHash ?? null)
                  : ((row.body as BreachBody).observedTxHash ?? null)
              }
              prompt={row.context?.reasoning ?? null}
              injected={row.context?.injected ?? false}
              href={hashscanTopicMessage(JOURNAL_TOPIC_ID, row.seq)}
            />
          ))
        )}
      </section>
    </>
  );
}
