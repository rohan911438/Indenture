import { readTopic } from "@indenture/hedera/mirror";
import { JOURNAL_TOPIC, MIRROR_URL } from "@/lib/deployments";

export const revalidate = 10;

/** The full append-only journal: every CONTEXT, RECEIPT, BREACH in order. */
export default async function Journal() {
  const messages = JOURNAL_TOPIC
    ? await readTopic(JOURNAL_TOPIC, { mirrorUrl: MIRROR_URL, limit: 100, order: "desc" })
    : [];

  return (
    <div className="space-y-4 text-sm">
      <h1 className="text-2xl font-bold">Journal</h1>
      <p className="text-neutral-400">
        Topic {JOURNAL_TOPIC || "(unset)"} &mdash; read straight from the mirror
        node. This is the only database.
      </p>
      <table className="w-full text-xs">
        <thead className="text-neutral-500 text-left">
          <tr>
            <th className="py-1">seq</th>
            <th>type</th>
            <th>summary</th>
          </tr>
        </thead>
        <tbody>
          {messages.map((m) => {
            const b = (m.envelope?.body ?? {}) as Record<string, unknown>;
            return (
              <tr key={m.sequenceNumber} className="border-t border-neutral-900">
                <td className="py-1 pr-2 text-neutral-500">{m.sequenceNumber}</td>
                <td className="pr-2">{m.envelope?.type ?? "raw"}</td>
                <td className="text-neutral-400">
                  {String(b.decision ?? b.covenant ?? b.reasoning ?? m.raw.slice(0, 80))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
