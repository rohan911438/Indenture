"use client";

import { useCallback, useRef, useState } from "react";
import type { AttackScenario } from "@/lib/data";
import type { JournalRow } from "@/lib/types";
import { AttackConsole } from "@/components/AttackConsole";
import { FeaturedBlock } from "@/components/FeaturedBlock";
import { JournalEntry } from "@/components/JournalEntry";
import { Rule } from "@/components/ui/Rule";
import { SeqRailHead } from "@/components/ui/SeqRail";

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
    <div className="space-y-14">
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
        <div className="border-l-2 border-hairline pl-6">
          <p className="prose-measure font-serif text-[1.25rem] italic leading-relaxed text-slate-lit">
            Nothing has been blocked yet, which is the honest state of a fund
            whose manager has not yet tried anything it should not.
          </p>
          <p className="prose-measure mt-4 font-sans text-meta text-slate-lit">
            Fire one from the console above to put the first entry on this wall,
            or run{" "}
            <span className="data text-signal">npm run inject</span> against the
            Validator to do it from a terminal.
          </p>
        </div>
      )}

      {rest.length > 0 && (
        <div>
          <h2 className="subheading text-signal">Earlier</h2>
          <div className="mt-8">
            <SeqRailHead topicId={topicId} />
            <Rule className="mt-3" />
            <div className="divide-y divide-hairline">
              {rest.map((row) => (
                <JournalEntry
                  key={`${row.type}-${row.seq}`}
                  row={row}
                  topicId={topicId}
                />
              ))}
            </div>
            <Rule />
          </div>
        </div>
      )}
    </div>
  );
}
