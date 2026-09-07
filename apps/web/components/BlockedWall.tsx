"use client";

import { useCallback, useRef, useState } from "react";
import type { AttackScenario } from "@/lib/data";
import type { JournalRow } from "@/lib/types";
import { AttackConsole } from "@/components/AttackConsole";
import { FeaturedBlock } from "@/components/FeaturedBlock";
import { JournalEntry } from "@/components/JournalEntry";

export function BlockedWall({
  initialRows,
  scenarios,
  topicId,
  validatorUrl,
}: {
  initialRows: JournalRow[];
  scenarios: AttackScenario[];
  topicId: string;
  /** empty until a Validator is deployed — the console says which mode it is in */
  validatorUrl: string;
}) {
  const [extra, setExtra] = useState<JournalRow[]>([]);
  const featuredRef = useRef<HTMLDivElement>(null);

  const onResult = useCallback((row: JournalRow) => {
    setExtra((e) => [row, ...e]);
    requestAnimationFrame(() =>
      featuredRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }, []);

  const combined = [...extra, ...initialRows];
  // Feature a console result if there is one; otherwise the most recent
  // refusal that carries the text the model saw (the illustrative case);
  // otherwise just the newest row.
  const featured =
    extra[0] ??
    combined.find(
      (r) => r.type === "RECEIPT" && r.context && !!r.context.injected,
    ) ??
    combined[0];
  const rest = combined.filter((r) => r !== featured);
  const featuredIsFresh = extra.length > 0 && featured === extra[0];

  return (
    <div className="space-y-8">
      <AttackConsole
        scenarios={scenarios}
        onResult={onResult}
        validatorUrl={validatorUrl}
      />

      {featured ? (
        <div ref={featuredRef} className="scroll-mt-24">
          <FeaturedBlock
            row={featured}
            topicId={topicId}
            fresh={featuredIsFresh}
          />
        </div>
      ) : (
        <p className="font-serif italic text-[16px] text-slate">
          Nothing has been blocked yet. Fire one from the console above, or run{" "}
          <span className="font-mono not-italic">npm run inject</span> against
          the Validator.
        </p>
      )}

      {rest.length > 0 && (
        <div>
          <div className="font-mono text-xs uppercase tracking-[0.25em] text-slate">
            Earlier
          </div>
          <div className="mt-4 divide-y divide-hairline border-t border-hairline">
            {rest.map((row) => (
              <JournalEntry
                key={`${row.type}-${row.seq}`}
                row={row}
                topicId={topicId}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
