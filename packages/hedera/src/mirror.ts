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

export async function readTopic(
  topicId: string,
  opts: ReadTopicOpts = {},
): Promise<TopicMessage[]> {
  const res = await fetch(topicMessagesUrl(topicId, opts), {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`mirror ${res.status} for topic ${topicId}`);
  const json = (await res.json()) as {
    messages: {
      sequence_number: number;
      consensus_timestamp: string;
      message: string;
    }[];
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
