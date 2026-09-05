import {
  type Hex,
  keccak256,
  encodeAbiParameters,
  hashTypedData,
  recoverTypedDataAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  PRIMARY_TYPE,
  RECEIPT_TYPE,
  receiptDomain,
  receiptSchema,
  type Receipt,
  type SignedReceipt,
} from "./types.js";

export type SwapParams = {
  zeroForOne: boolean;
  amountSpecified: bigint;
  sqrtPriceLimitX96: bigint;
};

/** keccak256(abi.encode(SwapParams)) - MUST match `keccak256(params)` in Solidity. */
export function paramsHash(p: SwapParams): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { name: "zeroForOne", type: "bool" },
        { name: "amountSpecified", type: "int256" },
        { name: "sqrtPriceLimitX96", type: "uint160" },
      ],
      [p.zeroForOne, p.amountSpecified, p.sqrtPriceLimitX96],
    ),
  );
}

export function digest(args: {
  receipt: Receipt;
  chainId: number;
  verifyingContract: Hex;
}): Hex {
  return hashTypedData({
    domain: receiptDomain(args),
    types: RECEIPT_TYPE,
    primaryType: PRIMARY_TYPE,
    message: args.receipt,
  });
}

/** The Validator's only signing path. Holds VALIDATOR_KEY. */
export async function signReceipt(args: {
  receipt: Receipt;
  chainId: number;
  verifyingContract: Hex;
  privateKey: Hex;
}): Promise<SignedReceipt> {
  const receipt = receiptSchema.parse(args.receipt) as Receipt;
  const account = privateKeyToAccount(args.privateKey);
  const signature = await account.signTypedData({
    domain: receiptDomain(args),
    types: RECEIPT_TYPE,
    primaryType: PRIMARY_TYPE,
    message: receipt,
  });
  return { receipt, signature, signer: account.address };
}

export async function recoverReceiptSigner(args: {
  receipt: Receipt;
  chainId: number;
  verifyingContract: Hex;
  signature: Hex;
}): Promise<Hex> {
  return recoverTypedDataAddress({
    domain: receiptDomain(args),
    types: RECEIPT_TYPE,
    primaryType: PRIMARY_TYPE,
    message: args.receipt,
    signature: args.signature,
  });
}
