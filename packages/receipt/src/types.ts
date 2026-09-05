import { z } from "zod";
import type { Hex, TypedDataDomain } from "viem";

/**
 * The EIP-712 Receipt. This MUST stay byte-identical to
 * `contracts/src/libs/ReceiptLib.sol`. The guard is
 * `test_SignedInTypescript_RecoversInSolidity` (write it first).
 *
 * Field order is part of the type hash - do not reorder.
 */
export const RECEIPT_TYPE = {
  Receipt: [
    { name: "mandateHash", type: "bytes32" },
    { name: "poolId", type: "bytes32" },
    { name: "paramsHash", type: "bytes32" },
    { name: "seq", type: "uint64" },
    { name: "deadline", type: "uint64" },
    { name: "vault", type: "address" },
  ],
} as const;

export const PRIMARY_TYPE = "Receipt" as const;

const hex32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/, "expected 32-byte hex");
const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "expected address");

export const receiptSchema = z
  .object({
    mandateHash: hex32,
    poolId: hex32,
    paramsHash: hex32,
    seq: z.bigint().nonnegative(),
    deadline: z.bigint().positive(),
    vault: address,
  })
  .strict();

export type Receipt = {
  mandateHash: Hex;
  poolId: Hex;
  paramsHash: Hex;
  seq: bigint;
  deadline: bigint;
  vault: Hex;
};

/** EIP-712 domain. `verifyingContract` is the MandatePolicy address. */
export function receiptDomain(params: {
  chainId: number;
  verifyingContract: Hex;
}): TypedDataDomain {
  return {
    name: "Indenture",
    version: "1",
    chainId: params.chainId,
    verifyingContract: params.verifyingContract,
  };
}

export type SignedReceipt = {
  receipt: Receipt;
  signature: Hex;
  signer: Hex;
};
