import { encodeAbiParameters, type Hex } from "viem";
import { makeEnvelope, type Envelope } from "@indenture/hedera/envelope";
import type { Proposal } from "./proposer.js";

/**
 * The CONTEXT envelope: the untrusted Manager's raw proposal + reasoning,
 * journaled for the audit trail. It is NEVER forwarded to the Validator - the
 * Validator's input is exactly {poolId, swapParams}.
 */
export function buildContextEnvelope(args: {
  vault: string;
  proposer: string;
  proposal: Proposal;
  injected?: boolean;
}): Envelope {
  return makeEnvelope({
    type: "CONTEXT",
    vault: args.vault,
    body: {
      proposer: args.proposer,
      poolId: args.proposal.poolId,
      swapParams: args.proposal.swapParams,
      reasoning: args.proposal.reasoning,
      injected: args.injected ?? false,
    },
  });
}

/** exactly what crosses the boundary to the Validator - reasoning dropped */
export function validatorRequest(proposal: Proposal): {
  poolId: string;
  swapParams: Proposal["swapParams"];
} {
  return { poolId: proposal.poolId, swapParams: proposal.swapParams };
}

// --- the receipt blob the Manager forwards to vault.trade() as hookData ----

const RECEIPT_TUPLE = {
  type: "tuple",
  components: [
    { name: "mandateHash", type: "bytes32" },
    { name: "poolId", type: "bytes32" },
    { name: "paramsHash", type: "bytes32" },
    { name: "seq", type: "uint64" },
    { name: "deadline", type: "uint64" },
    { name: "vault", type: "address" },
  ],
} as const;

export type WireReceipt = {
  mandateHash: Hex;
  poolId: Hex;
  paramsHash: Hex;
  seq: string | bigint;
  deadline: string | bigint;
  vault: Hex;
};

/** abi.encode(ReceiptLib.Receipt, bytes signature) - forwarded verbatim as
 *  v4 hookData; the vault never inspects it. */
export function encodeReceiptBlob(r: WireReceipt, signature: Hex): Hex {
  return encodeAbiParameters(
    [RECEIPT_TUPLE, { type: "bytes" }],
    [
      {
        mandateHash: r.mandateHash,
        poolId: r.poolId,
        paramsHash: r.paramsHash,
        seq: BigInt(r.seq),
        deadline: BigInt(r.deadline),
        vault: r.vault,
      },
      signature,
    ],
  );
}
