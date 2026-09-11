/**
 * Mirror node reader. Pure HTTP + JSON - safe on the edge and in the browser.
 * This is "the only database": HCS topic messages read back as the journal,
 * and contract logs read back as the on-chain event stream for the journaler.
 */
import { envelopeSchema, type Envelope } from "./envelope.js";

export const DEFAULT_MIRROR = "https://testnet.mirrornode.hedera.com/api/v1";

export type TopicMessage = {
  sequenceNumber: number;
  consensusTimestamp: string;
  envelope: Envelope | null; // null when the message is not a valid envelope
  raw: string;
};

export type ReadTopicOpts = {
  mirrorUrl?: string;
  limit?: number;
  order?: "asc" | "desc";
  /** only messages with sequence_number strictly greater than this (cursor) */
  sinceSeq?: number;
};

/** Build the mirror-node URL for a topic-messages read. Pure, unit-testable. */
export function topicMessagesUrl(topicId: string, opts: ReadTopicOpts = {}): string {
  const base = opts.mirrorUrl ?? DEFAULT_MIRROR;
  const url = new URL(`${base}/topics/${topicId}/messages`);
  url.searchParams.set("limit", String(opts.limit ?? 100));
  url.searchParams.set("order", opts.order ?? "desc");
  if (opts.sinceSeq !== undefined) {
    url.searchParams.set("sequencenumber", `gt:${opts.sinceSeq}`);
  }
  return url.toString();
}

/** One topic message exactly as the mirror node returns it. */
export type RawTopicMessage = {
  sequence_number: number;
  consensus_timestamp: string;
  message: string; // base64
  chunk_info?: {
    initial_transaction_id?: {
      account_id?: string;
      nonce?: number;
      transaction_valid_start?: string;
    } | null;
    number?: number;
    total?: number;
  } | null;
};

/** Chunks of one submission share an initial transaction id. */
function groupKey(m: RawTopicMessage): string | null {
  const id = m.chunk_info?.initial_transaction_id;
  if (!id) return null;
  return `${id.account_id ?? ""}@${id.transaction_valid_start ?? ""}#${id.nonce ?? 0}`;
}

/**
 * Reassemble chunked submissions, then parse.
 *
 * The SDK splits any message over 1024 bytes across several topic messages,
 * and the mirror node returns them as separate rows. Parsing each row on its
 * own means a chunked envelope never parses at all — and because callers
 * treat "no valid envelope" as "nothing published yet", a mandate too long to
 * fit in one chunk is indistinguishable from a mandate that was never
 * published. That is exactly what happened on the first real deploy: the
 * Validator read its own embedded fixture and reported mandate sequence 0
 * while the correct document sat on the topic in two pieces.
 *
 * Concatenation is done on BYTES, not on decoded strings. HCS splits at 1024
 * bytes with no regard for character boundaries, so decoding each chunk
 * separately can corrupt a multi-byte character that straddles the split.
 *
 * A group whose chunks are not all present in this page stays unparsed. That
 * is the honest answer: the caller asked for a window, and the document is
 * only partly inside it. Widen the limit rather than guess at the remainder.
 */
export function reassembleChunks(messages: RawTopicMessage[]): TopicMessage[] {
  const groups = new Map<string, RawTopicMessage[]>();
  const out: TopicMessage[] = [];

  const parse = (bytes: Buffer, seq: number, ts: string): TopicMessage => {
    const raw = bytes.toString("utf8");
    let envelope: Envelope | null = null;
    try {
      envelope = envelopeSchema.parse(JSON.parse(raw));
    } catch {
      envelope = null;
    }
    return { sequenceNumber: seq, consensusTimestamp: ts, envelope, raw };
  };

  for (const m of messages) {
    const total = m.chunk_info?.total ?? 1;
    const key = groupKey(m);
    if (total <= 1 || !key) {
      out.push(
        parse(Buffer.from(m.message, "base64"), m.sequence_number, m.consensus_timestamp),
      );
      continue;
    }
    const bucket = groups.get(key) ?? [];
    bucket.push(m);
    groups.set(key, bucket);
  }

  for (const bucket of groups.values()) {
    const total = bucket[0]?.chunk_info?.total ?? bucket.length;
    if (bucket.length < total) {
      // Incomplete. Surface the pieces unparsed rather than dropping them, so
      // a caller counting messages still sees that something is there.
      for (const m of bucket) {
        out.push({
          sequenceNumber: m.sequence_number,
          consensusTimestamp: m.consensus_timestamp,
          envelope: null,
          raw: Buffer.from(m.message, "base64").toString("utf8"),
        });
      }
      continue;
    }
    const ordered = [...bucket].sort(
      (a, b) => (a.chunk_info?.number ?? 0) - (b.chunk_info?.number ?? 0),
    );
    const last = ordered[ordered.length - 1]!;
    out.push(
      parse(
        Buffer.concat(ordered.map((m) => Buffer.from(m.message, "base64"))),
        // The whole document is only on the topic once its last chunk is, so
        // that is the sequence number a reader should cursor from.
        last.sequence_number,
        last.consensus_timestamp,
      ),
    );
  }

  // Preserve the order the mirror node was asked for.
  const descending = (messages[0]?.sequence_number ?? 0) > (messages.at(-1)?.sequence_number ?? 0);
  out.sort((a, b) =>
    descending ? b.sequenceNumber - a.sequenceNumber : a.sequenceNumber - b.sequenceNumber,
  );
  return out;
}

export async function readTopic(
  topicId: string,
  opts: ReadTopicOpts = {},
): Promise<TopicMessage[]> {
  const res = await fetch(topicMessagesUrl(topicId, opts), {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`mirror ${res.status} for topic ${topicId}`);
  const json = (await res.json()) as { messages: RawTopicMessage[] };
  return reassembleChunks(json.messages ?? []);
}

// --- contract logs (the on-chain event stream the journaler polls) ---------

export type ContractLog = {
  address: string;
  /** topic[0] is the event signature hash; topic[1..] are indexed args */
  topics: string[];
  data: string;
  blockNumber: number;
  transactionHash: string;
  index: number;
  timestamp: string;
};

export type ReadLogsOpts = {
  mirrorUrl?: string;
  /** filter by event signature hash (topic0), e.g. keccak of the event ABI */
  topic0?: string;
  /** consensus timestamp lower bound, exclusive - the journaler cursor */
  sinceTimestamp?: string;
  limit?: number;
  order?: "asc" | "desc";
};

/** Build the mirror-node URL for a contract-logs read. Pure, unit-testable. */
export function contractLogsUrl(contractId: string, opts: ReadLogsOpts = {}): string {
  const base = opts.mirrorUrl ?? DEFAULT_MIRROR;
  const url = new URL(`${base}/contracts/${contractId}/results/logs`);
  url.searchParams.set("limit", String(opts.limit ?? 100));
  url.searchParams.set("order", opts.order ?? "asc");
  if (opts.topic0) url.searchParams.set("topic0", opts.topic0);
  if (opts.sinceTimestamp) url.searchParams.set("timestamp", `gt:${opts.sinceTimestamp}`);
  return url.toString();
}

export async function readContractLogs(
  contractId: string,
  opts: ReadLogsOpts = {},
): Promise<ContractLog[]> {
  const res = await fetch(contractLogsUrl(contractId, opts), {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`mirror ${res.status} for contract ${contractId}`);
  const json = (await res.json()) as {
    logs: {
      address: string;
      topics: string[];
      data: string;
      block_number: number;
      transaction_hash: string;
      index: number;
      timestamp: string;
    }[];
  };
  return json.logs.map((l) => ({
    address: l.address,
    topics: l.topics,
    data: l.data,
    blockNumber: l.block_number,
    transactionHash: l.transaction_hash,
    index: l.index,
    timestamp: l.timestamp,
  }));
}
