import { describe, it, expect } from "vitest";
import {
  topicMessagesUrl,
  contractLogsUrl,
  reassembleChunks,
  DEFAULT_MIRROR,
} from "./mirror.js";

describe("topicMessagesUrl", () => {
  it("defaults to desc, limit 100, no cursor", () => {
    const u = new URL(topicMessagesUrl("0.0.1234"));
    expect(u.origin + u.pathname).toBe(`${DEFAULT_MIRROR}/topics/0.0.1234/messages`);
    expect(u.searchParams.get("order")).toBe("desc");
    expect(u.searchParams.get("limit")).toBe("100");
    expect(u.searchParams.get("sequencenumber")).toBeNull();
  });

  it("adds a gt: cursor when sinceSeq is given", () => {
    const u = new URL(
      topicMessagesUrl("0.0.1", { order: "asc", limit: 25, sinceSeq: 7 }),
    );
    expect(u.searchParams.get("order")).toBe("asc");
    expect(u.searchParams.get("limit")).toBe("25");
    expect(u.searchParams.get("sequencenumber")).toBe("gt:7");
  });

  it("honours a custom mirror url", () => {
    const u = topicMessagesUrl("0.0.1", { mirrorUrl: "https://example.test/api/v1" });
    expect(u.startsWith("https://example.test/api/v1/topics/0.0.1/messages")).toBe(true);
  });
});

describe("contractLogsUrl", () => {
  it("defaults to asc for cursor-forward scanning", () => {
    const u = new URL(contractLogsUrl("0.0.9"));
    expect(u.pathname).toBe("/api/v1/contracts/0.0.9/results/logs");
    expect(u.searchParams.get("order")).toBe("asc");
  });

  it("filters by topic0 and a timestamp cursor", () => {
    const u = new URL(
      contractLogsUrl("0.0.9", {
        topic0: "0xabc",
        sinceTimestamp: "1725000000.000000000",
      }),
    );
    expect(u.searchParams.get("topic0")).toBe("0xabc");
    expect(u.searchParams.get("timestamp")).toBe("gt:1725000000.000000000");
  });
});

/**
 * The first real testnet publish produced a two-chunk mandate, and every
 * reader silently fell back to its embedded fixture. "Too long for one
 * chunk" looked exactly like "never published".
 */
describe("chunked submissions", () => {
  const envelope = {
    v: 1,
    type: "MANDATE",
    vault: "0x3be7042D043924CC4114859a66b6a3Fc43b69047",
    ts: 1789063927,
    body: { yaml: "name: fund one\n", mandateHash: `0x${"a".repeat(64)}` },
  };
  const json = JSON.stringify(envelope);
  const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64");

  const chunk = (n: number, total: number, payload: Buffer, seq: number) => ({
    sequence_number: seq,
    consensus_timestamp: `178906392${seq}.000000000`,
    message: payload.toString("base64"),
    chunk_info: {
      initial_transaction_id: {
        account_id: "0.0.10463024",
        nonce: 0,
        transaction_valid_start: "1789063927.045721879",
      },
      number: n,
      total,
    },
  });

  const split = (s: string, at: number) => [
    Buffer.from(s).subarray(0, at),
    Buffer.from(s).subarray(at),
  ];

  it("joins two chunks back into one envelope", () => {
    const [a, b] = split(json, 40);
    const out = reassembleChunks([chunk(1, 2, a!, 1), chunk(2, 2, b!, 2)]);
    expect(out).toHaveLength(1);
    expect(out[0]!.envelope?.type).toBe("MANDATE");
  });

  it("reports the LAST chunk's sequence number", () => {
    // The document is only on the topic once its final chunk is. Cursoring
    // from the first would re-read it forever.
    const [a, b] = split(json, 40);
    expect(reassembleChunks([chunk(1, 2, a!, 1), chunk(2, 2, b!, 2)])[0]!.sequenceNumber).toBe(2);
  });

  it("joins chunks that arrive out of order", () => {
    const [a, b] = split(json, 40);
    const out = reassembleChunks([chunk(2, 2, b!, 2), chunk(1, 2, a!, 1)]);
    expect(out[0]!.envelope?.type).toBe("MANDATE");
  });

  it("does not corrupt a multi-byte character split across the boundary", () => {
    // HCS splits at 1024 BYTES, not characters. Decoding each chunk on its
    // own turns a straddling character into two replacement characters.
    const text = JSON.stringify({ ...envelope, body: { ...envelope.body, yaml: "fee: 30 €\n" } });
    const bytes = Buffer.from(text);
    const boundary = bytes.indexOf(Buffer.from("€")) + 1; // mid-character
    const out = reassembleChunks([
      chunk(1, 2, bytes.subarray(0, boundary), 1),
      chunk(2, 2, bytes.subarray(boundary), 2),
    ]);
    expect(out[0]!.raw).toContain("€");
    expect(out[0]!.envelope).not.toBeNull();
  });

  it("leaves an incomplete group unparsed rather than guessing", () => {
    const [a] = split(json, 40);
    const out = reassembleChunks([chunk(1, 2, a!, 1)]);
    expect(out).toHaveLength(1);
    expect(out[0]!.envelope).toBeNull();
  });

  it("still handles unchunked messages", () => {
    const out = reassembleChunks([
      { sequence_number: 7, consensus_timestamp: "1.0", message: b64(json) },
    ]);
    expect(out[0]!.envelope?.type).toBe("MANDATE");
    expect(out[0]!.sequenceNumber).toBe(7);
  });

  it("keeps descending order when the mirror was asked for it", () => {
    const [a, b] = split(json, 40);
    const out = reassembleChunks([
      { sequence_number: 9, consensus_timestamp: "9.0", message: b64(json) },
      chunk(2, 2, b!, 2),
      chunk(1, 2, a!, 1),
    ]);
    expect(out.map((m) => m.sequenceNumber)).toEqual([9, 2]);
  });
});
