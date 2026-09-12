/**
 * Where a number came from, in one voice, everywhere.
 *
 * lib/data.ts returns `Sourced<T>` — the value plus whether it was read live.
 * That honesty is the project's whole claim, so it gets one component rather
 * than being re-phrased at each call site. Three states, because there are
 * genuinely three:
 *
 *   live, clean      read from the mirror node and complete
 *   live, caveated   read live, but something in it could not be measured
 *   sample           fixtures, and it says so
 *
 * The left rule reuses the site's rule vocabulary: brass means this is the
 * enforced thing, oxblood means something is missing or refused.
 */
export function SourceNote({
  live,
  note,
  subject,
  className = "",
}: {
  live: boolean;
  note?: string;
  /** what the label is about, e.g. "These covenant figures" */
  subject: string;
  className?: string;
}) {
  const edge = live && !note ? "border-brass" : live ? "border-brass" : "border-oxblood-edge";

  return (
    <div className={`border-l-2 pl-3 ${edge} ${className}`}>
      {live ? (
        <p className="font-sans text-data text-slate-lit">
          {subject} are read live from the Hedera mirror node and re-derived
          from source.
          {note && <span className="text-oxblood-lit"> {capitalise(note)}.</span>}
        </p>
      ) : (
        <p className="font-sans text-data text-slate-lit">
          {subject} are{" "}
          <span className="text-oxblood-lit">sample data</span> —{" "}
          {note ?? "no live source available"}.
        </p>
      )}
    </div>
  );
}

/** A short inline form, for places a block would break the line. */
export function SourceMark({ live, note }: { live: boolean; note?: string }) {
  if (live && !note) {
    return (
      <span className="font-sans text-micro text-brass">
        live from the mirror node
      </span>
    );
  }
  if (live) {
    return (
      <span className="font-sans text-micro text-oxblood-lit">
        live, with one gap — {note}
      </span>
    );
  }
  return (
    <span className="font-sans text-micro text-oxblood-lit">
      sample data — {note ?? "no live source available"}
    </span>
  );
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
