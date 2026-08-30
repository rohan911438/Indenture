/**
 * Mirror node reader. Pure HTTP + JSON - safe on the edge and in the browser.
 * This is "the only database": HCS topic messages read back as the journal.
 */
import { envelopeSchema, type Envelope } from "./envelope.js";

const DEFAULT_MIRROR = "https://testnet.mirrornode.hedera.com/api/v1";

export type TopicMessage = {
  sequenceNumber: number;
  consensusTimestamp: string;
  envelope: Envelope | null; // null when the message is not a valid envelope
  raw: string;
};

export async function readTopic(
  topicId: string,
  opts: { mirrorUrl?: string; limit?: number; order?: "asc" | "desc" } = {},
): Promise<TopicMessage[]> {
  const base = opts.mirrorUrl ?? DEFAULT_MIRROR;
  const url = new URL(`${base}/topics/${topicId}/messages`);
  url.searchParams.set("limit", String(opts.limit ?? 100));
  url.searchParams.set("order", opts.order ?? "desc");

  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`mirror ${res.status} for topic ${topicId}`);
  const json = (await res.json()) as {
    messages: { sequence_number: number; consensus_timestamp: string; message: string }[];
  };

  return json.messages.map((m) => {
    const raw = Buffer.from(m.message, "base64").toString("utf8");
    let envelope: Envelope | null = null;
    try {
      envelope = envelopeSchema.parse(JSON.parse(raw));
    } catch {
      envelope = null;
    }
    return {
      sequenceNumber: m.sequence_number,
      consensusTimestamp: m.consensus_timestamp,
      envelope,
      raw,
    };
  });
}
