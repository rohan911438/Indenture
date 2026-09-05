/**
 * Pure chunk-sizing helpers. No @hashgraph/sdk import, so this is safe to
 * pull into the edge Validator or the browser for a pre-flight size check.
 */
import { type Envelope } from "./envelope.js";

/** Hedera caps a single topic message at 1024 bytes; larger messages are
 *  split into chunks by the SDK, each its own consensus message, reassembled
 *  by the mirror node. */
export const HCS_CHUNK_BYTES = 1024;
export const HCS_DEFAULT_MAX_CHUNKS = 20;

/** utf-8 byte length of the serialized envelope. */
export function messageByteLength(envelope: Envelope): number {
  return Buffer.byteLength(JSON.stringify(envelope), "utf8");
}

/** How many 1024-byte chunks this envelope needs. */
export function estimateChunks(envelope: Envelope): number {
  return Math.max(1, Math.ceil(messageByteLength(envelope) / HCS_CHUNK_BYTES));
}
