/**
 * Types transcribed FROM shared-contracts/ — not invented here.
 *   - envelope + bodies: hcs-envelope-schema.md
 *   - covenant / refusal vocabulary: validator-api.md
 *   - Executed / breach fields: contract-events.md
 *
 * The mock reader (lib/data.ts) and the future mirror-node client both return
 * these shapes, so components never learn which one they got.
 */

export type EnvelopeType = "MANDATE" | "RECEIPT" | "BREACH" | "CONTEXT";

export type Covenant =
  | "maxPositionBps"
  | "minCashBps"
  | "maxTradeNotional"
  | "maxDailyNotional";

/** validator-api.md — the `covenant` field on a refusal, in check order */
export type RefusalCovenant =
  | "feedStaleness"
  | "assetNotInUniverse"
  | "maxTradeNotional"
  | "maxDailyNotional"
  | "maxPositionBps"
  | "minCashBps";

export interface CovenantValues {
  maxPositionBps: number;
  minCashBps: number;
  /** decimal strings — quote units (USDC, 6dp) */
  maxTradeNotional: string;
  maxDailyNotional: string;
}

export interface SwapParams {
  zeroForOne: boolean;
  amountSpecified: string; // int256 decimal string
  sqrtPriceLimitX96: string; // uint160 decimal string
}

// --- bodies (hcs-envelope-schema.md) --------------------------------------

export interface MandateBody {
  action: "ADOPTED" | "AMENDED";
  mandateHash: string;
  yaml: string;
  covenants: CovenantValues;
  prevMandateHash: string | null;
}

export interface ReceiptBody {
  decision: "APPROVED" | "REFUSED";
  reason: string;
  mandateHash?: string;
  poolId?: string;
  paramsHash?: string;
  seq?: number;
  signature?: string; // present only when APPROVED
  /** set when the journaler reconstructed this from an on-chain event */
  source?: string;
}

export interface BreachBody {
  covenant: Covenant | string;
  observedTxHash: string;
  detail: string;
  nonce?: number;
}

export interface ContextBody {
  proposer: "RuleProposer" | "LlmProposer";
  poolId: string;
  swapParams: SwapParams;
  reasoning: string;
  injected: boolean;
}

export type EnvelopeBody =
  | MandateBody
  | ReceiptBody
  | BreachBody
  | ContextBody;

export interface Envelope<B = EnvelopeBody> {
  v: 1;
  type: EnvelopeType;
  vault: string;
  ts: number;
  body: B;
}

/**
 * One row as the mirror node returns it (packages/hedera `TopicMessage`).
 * `envelope` is null when a topic message failed to parse as an envelope.
 */
export interface TopicMessage<B = EnvelopeBody> {
  sequenceNumber: number;
  consensusTimestamp: string; // "1725119880.123456789"
  envelope: Envelope<B> | null;
  raw: string;
}

// --- a /blocked or /journal row, after lib/data.ts has joined CONTEXT -----

export interface JournalRow {
  seq: number;
  type: EnvelopeType;
  vault: string;
  ts: number;
  body: EnvelopeBody;
  /** the CONTEXT the model saw for this nonce, if one was journaled */
  context?: ContextBody;
}

export interface SharesWallet {
  address: string;
  label: string;
  identityVerified: boolean;
  /** the exact ComplianceRefused reason when identityVerified is false */
  refusalReason?: string;
}
