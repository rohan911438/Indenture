/**
 * NODE-ONLY. Imports @hashgraph/sdk, which needs gRPC over HTTP/2 and will not
 * run on Cloudflare Workers / edge. Only apps/journaler and scripts use this.
 */
import {
  Client,
  PrivateKey,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
} from "@hashgraph/sdk";
import { envelopeSchema, type Envelope } from "./envelope.js";
import {
  estimateChunks,
  HCS_DEFAULT_MAX_CHUNKS,
} from "./chunk.js";

export {
  estimateChunks,
  messageByteLength,
  HCS_CHUNK_BYTES,
  HCS_DEFAULT_MAX_CHUNKS,
} from "./chunk.js";

export type HcsAuth = {
  operatorId: string; // 0.0.xxxxx
  operatorKey: string; // DER, or raw 32-byte hex — see parseOperatorKey
  network?: "testnet" | "mainnet" | "previewnet";
};

/**
 * Accept either form the Hedera portal shows you.
 *
 * The portal displays a "HEX Encoded Private Key" and a "DER Encoded Private
 * Key" for the same account, and the rest of this repo needs the HEX one,
 * because Foundry and viem cannot read DER. Requiring DER here meant the one
 * value in `.env` had to be in the format the EVM tooling rejects, so either
 * the deploy or the journaler was always going to fail, whichever the user
 * pasted. `fromStringDer` throws on raw hex with a message about ASN.1 that
 * points nowhere near the actual problem.
 *
 * Raw hex is ECDSA here, not ED25519. Every EVM path in this project needs a
 * secp256k1 account, so an ED25519 key would fail two steps later anyway,
 * with a worse error. DER carries its own curve identifier, so that branch
 * still handles both.
 */
export function parseOperatorKey(key: string): PrivateKey {
  const raw = key.trim();
  const hex = raw.startsWith("0x") || raw.startsWith("0X") ? raw.slice(2) : raw;
  if (/^[0-9a-fA-F]{64}$/.test(hex)) return PrivateKey.fromStringECDSA(hex);
  return PrivateKey.fromStringDer(raw);
}

export function hcsClient(auth: HcsAuth): Client {
  const client =
    auth.network === "mainnet"
      ? Client.forMainnet()
      : auth.network === "previewnet"
        ? Client.forPreviewnet()
        : Client.forTestnet();
  client.setOperator(auth.operatorId, parseOperatorKey(auth.operatorKey));
  return client;
}

export async function createTopic(
  client: Client,
  memo: string,
): Promise<string> {
  const tx = await new TopicCreateTransaction().setTopicMemo(memo).execute(client);
  const receipt = await tx.getReceipt(client);
  const id = receipt.topicId;
  if (!id) throw new Error("topic id missing from receipt");
  return id.toString();
}

export type SubmitOpts = {
  /** hard ceiling on chunk count; throws before submitting if exceeded */
  maxChunks?: number;
};

/**
 * Submit one envelope to a topic. Auto-chunks via the SDK when the serialized
 * message exceeds 1024 bytes; refuses (throws, no submit) if it would need more
 * than `maxChunks` chunks so an oversized payload never silently costs a burst
 * of HBAR.
 */
export async function submit(
  client: Client,
  topicId: string,
  envelope: Envelope,
  opts: SubmitOpts = {},
): Promise<{ sequenceNumber: string; chunks: number }> {
  const e = envelopeSchema.parse(envelope);
  const maxChunks = opts.maxChunks ?? HCS_DEFAULT_MAX_CHUNKS;
  const chunks = estimateChunks(e);
  if (chunks > maxChunks) {
    throw new Error(
      `envelope needs ${chunks} chunks (> maxChunks ${maxChunks}); shrink the body`,
    );
  }
  const tx = new TopicMessageSubmitTransaction()
    .setTopicId(topicId)
    .setMessage(JSON.stringify(e));
  // setMaxChunks exists on the SDK tx; guard for older typings.
  (tx as unknown as { setMaxChunks?: (n: number) => void }).setMaxChunks?.(maxChunks);
  const resp = await tx.execute(client);
  const receipt = await resp.getReceipt(client);
  return {
    sequenceNumber: receipt.topicSequenceNumber?.toString() ?? "0",
    chunks,
  };
}
