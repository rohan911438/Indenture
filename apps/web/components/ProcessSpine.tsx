const STEPS = [
  { n: "1", text: "an untrusted agent proposes a trade" },
  { n: "2", text: "the Validator re-derives every fact from source, then signs or refuses" },
  { n: "3", text: "every decision is journaled to Hedera, permanently" },
];

/** The one-sentence mental model, persistent on every page. */
export function ProcessSpine() {
  return (
    <div className="border-b border-hairline">
      <div className="mx-auto max-w-deed px-6 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-slate">
        {STEPS.map((s, i) => (
          <span key={s.n} className="flex items-center gap-3">
            {i > 0 && <span className="text-slate/50">→</span>}
            <span>
              <span className="text-brass">{s.n}</span> {s.text}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
