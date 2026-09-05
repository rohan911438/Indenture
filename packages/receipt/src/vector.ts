/**
 * Emits a signing vector for the Solidity guard test. Run:
 *   npm run vector -w @indenture/receipt
 * then paste the JSON into contracts/test/Receipt.t.sol.
 */
import { digest, signReceipt } from "./sign.js";
import type { Receipt } from "./types.js";

const CHAIN_ID = 296;
const VERIFYING_CONTRACT = "0x00000000000000000000000000000000000000a4"; // placeholder MandatePolicy
// anvil account #0
const PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const receipt: Receipt = {
  mandateHash:
    "0x1111111111111111111111111111111111111111111111111111111111111111",
  poolId: "0x2222222222222222222222222222222222222222222222222222222222222222",
  paramsHash:
    "0x3333333333333333333333333333333333333333333333333333333333333333",
  seq: 0n,
  deadline: 4102444800n, // 2100-01-01
  vault: "0x00000000000000000000000000000000000000b0",
};

const signed = await signReceipt({
  receipt,
  chainId: CHAIN_ID,
  verifyingContract: VERIFYING_CONTRACT,
  privateKey: PRIVATE_KEY,
});

console.log(
  JSON.stringify(
    {
      receipt: {
        ...receipt,
        seq: receipt.seq.toString(),
        deadline: receipt.deadline.toString(),
      },
      digest: digest({
        receipt,
        chainId: CHAIN_ID,
        verifyingContract: VERIFYING_CONTRACT,
      }),
      signature: signed.signature,
      expectedSigner: signed.signer,
      chainId: CHAIN_ID,
      verifyingContract: VERIFYING_CONTRACT,
    },
    null,
    2,
  ),
);
