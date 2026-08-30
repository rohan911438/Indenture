import { readTopic } from "@indenture/hedera/mirror";
import { JOURNAL_TOPIC, MIRROR_URL } from "@/lib/deployments";

export const revalidate = 10; // 10s cache, matches the Validator's mirror cache

/**
 * THE DEMO'S MAIN STAGE. Build this first.
 * Every REFUSED receipt + every BREACH, newest first, with the reason spelled
 * out. A blocked attack is a feature - this page is where it becomes visible.
 */
export default async function Blocked() {
  const messages = JOURNAL_TOPIC
    ? await readTopic(JOURNAL_TOPIC, { mirrorUrl: MIRROR_URL, limit: 50, order: "desc" })
    : [];

  const blocks = messages.filter((m) => {
    const t = m.envelope?.type;
    if (t === "BREACH") return true;
    if (t === "RECEIPT") {
      const b = m.envelope?.body as { decision?: string } | undefined;
      return b?.decision === "REFUSED";
    }
    return false;
  });

  return (
    <div className="space-y-4 text-sm">
      <h1 className="text-2xl font-bold">Blocked</h1>
      <p className="text-neutral-400">
        Attacks and off-mandate trades that were stopped &mdash; and permanently
        recorded on Hedera Consensus Service.
      </p>

      {!JOURNAL_TOPIC && (
        <p className="text-amber-400">
          journalTopicId is not set in deployments.json yet.
        </p>
      )}

      {JOURNAL_TOPIC && blocks.length === 0 && (
        <p className="text-neutral-500">Nothing blocked yet. Run `npm run inject`.</p>
      )}

      <ul className="space-y-3">
        {blocks.map((m) => {
          const b = m.envelope?.body as Record<string, unknown>;
          return (
            <li key={m.sequenceNumber} className="border border-red-900/60 rounded p-4">
              <div className="flex justify-between text-xs text-neutral-500">
                <span>{m.envelope?.type}</span>
                <span>seq {m.sequenceNumber}</span>
              </div>
              <div className="mt-1 text-red-300">
                {String(b?.reason ?? b?.detail ?? "blocked")}
              </div>
              <div className="mt-1 text-neutral-500 text-xs break-all">
                {String(b?.covenant ?? b?.paramsHash ?? "")}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
