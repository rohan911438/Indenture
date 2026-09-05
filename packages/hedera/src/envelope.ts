import { z } from "zod";

/**
 * Every message on either HCS topic is one of these envelopes. Pure data, no
 * SDK import - safe to use from the edge Validator (which builds envelopes but
 * hands them to the Node journaler to actually submit).
 *
 *   MANDATE  - a compiled mandate was adopted / amended       (mandate topic)
 *   RECEIPT  - the Validator approved OR refused a proposal    (journal topic)
 *   BREACH   - a covenant breach was observed on-chain         (journal topic)
 *   CONTEXT  - the untrusted Manager's raw proposal + reasoning (journal topic)
 */
export const ENVELOPE_VERSION = 1 as const;

export const envelopeType = z.enum(["MANDATE", "RECEIPT", "BREACH", "CONTEXT"]);
export type EnvelopeType = z.infer<typeof envelopeType>;

export const envelopeSchema = z
  .object({
    v: z.literal(ENVELOPE_VERSION),
    type: envelopeType,
    vault: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    ts: z.number().int().positive(), // unix seconds, set by the submitter
    body: z.unknown(), // type-specific; validated by the reader per `type`
  })
  .strict();

export type Envelope = z.infer<typeof envelopeSchema>;

export function makeEnvelope(args: {
  type: EnvelopeType;
  vault: string;
  body: unknown;
  ts?: number;
}): Envelope {
  return envelopeSchema.parse({
    v: ENVELOPE_VERSION,
    type: args.type,
    vault: args.vault,
    ts: args.ts ?? Math.floor(Date.now() / 1000),
    body: args.body,
  });
}

// --- body shapes (used by readers + the web app) ---

export const receiptBody = z
  .object({
    decision: z.enum(["APPROVED", "REFUSED"]),
    reason: z.string(), // human-readable; for REFUSED this is the whole point
    // present when the receipt came from the Validator; absent when the
    // journaler reconstructs it from an on-chain Executed / ComplianceRefused.
    mandateHash: z.string().optional(),
    poolId: z.string().optional(),
    paramsHash: z.string().optional(),
    seq: z.number().int().nonnegative().optional(),
    signature: z.string().optional(), // present only when APPROVED (Validator path)
    source: z.string().optional(), // e.g. "onchain:Executed"
  })
  .passthrough();

export const breachBody = z
  .object({
    covenant: z.string(), // a bytes32 reason tag decoded to text
    observedTxHash: z.string(),
    detail: z.string(),
    nonce: z.number().int().nonnegative().optional(), // cross-link to the receipt seq
  })
  .passthrough();

export type ReceiptBody = z.infer<typeof receiptBody>;
export type BreachBody = z.infer<typeof breachBody>;
