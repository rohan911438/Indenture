import { Hono } from "hono";
import { z } from "zod";
import { keccak256, encodeAbiParameters, type Hex } from "viem";
import { signReceipt, type Receipt } from "@indenture/receipt";
import { makeEnvelope } from "@indenture/hedera/envelope";
import { validateRequestSchema } from "./schema.js";
import { runCovenantChecks } from "./checks.js";

type Bindings = {
  VALIDATOR_KEY: string; // wrangler secret
  CHAIN_ID: string;
  HEDERA_RPC_URL: string;
  HEDERA_MIRROR_URL: string;
  CACHE: KVNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get("/health", (c) => c.json({ ok: true, service: "indenture-validator" }));

/**
 * POST /validate
 * body: { poolId, swapParams }   <- .strict(), nothing else accepted
 * -> 200 { decision: "APPROVED", receipt, signature, journal }
 * -> 200 { decision: "REFUSED", reason, journal }   (a refusal is a product output)
 */
app.post("/validate", async (c) => {
  const parsed = validateRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ decision: "REFUSED", reason: "bad request shape", issues: parsed.error.issues }, 400);
  }
  const req = parsed.data;

  const ctx = {
    chainId: Number(c.env.CHAIN_ID),
    rpcUrl: c.env.HEDERA_RPC_URL,
    mirrorUrl: c.env.HEDERA_MIRROR_URL,
  };

  // TODO: load deployments.json-equivalent config (bundled at build time),
  //       resolve MandatePolicy address + current mandateHash + vault + seq.
  const MANDATE_POLICY = "0x00000000000000000000000000000000000000a4" as Hex;
  const VAULT = "0x00000000000000000000000000000000000000b0" as Hex;
  const mandateHash =
    "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;
  const seq = 0n;

  const checks = await runCovenantChecks(req, ctx);
  if (!checks.ok) {
    const journal = makeEnvelope({
      type: "RECEIPT",
      vault: VAULT,
      body: {
        decision: "REFUSED",
        reason: `${checks.covenant}: ${checks.reason}`,
        mandateHash,
        poolId: req.poolId,
        paramsHash: paramsHashOf(req),
        seq: Number(seq),
      },
    });
    return c.json({ decision: "REFUSED", reason: checks.reason, journal });
  }

  const receipt: Receipt = {
    mandateHash,
    poolId: req.poolId as Hex,
    paramsHash: paramsHashOf(req),
    seq,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 120),
    vault: VAULT,
  };

  const signed = await signReceipt({
    receipt,
    chainId: ctx.chainId,
    verifyingContract: MANDATE_POLICY,
    privateKey: c.env.VALIDATOR_KEY as Hex,
  });

  const journal = makeEnvelope({
    type: "RECEIPT",
    vault: VAULT,
    body: {
      decision: "APPROVED",
      reason: "covenants satisfied",
      mandateHash,
      poolId: req.poolId,
      paramsHash: receipt.paramsHash,
      seq: Number(seq),
      signature: signed.signature,
    },
  });

  return c.json({
    decision: "APPROVED",
    receipt: {
      ...receipt,
      seq: receipt.seq.toString(),
      deadline: receipt.deadline.toString(),
    },
    signature: signed.signature,
    signer: signed.signer,
    journal,
  });
});

function paramsHashOf(req: z.infer<typeof validateRequestSchema>): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { name: "zeroForOne", type: "bool" },
        { name: "amountSpecified", type: "int256" },
        { name: "sqrtPriceLimitX96", type: "uint160" },
      ],
      [
        req.swapParams.zeroForOne,
        BigInt(req.swapParams.amountSpecified),
        BigInt(req.swapParams.sqrtPriceLimitX96),
      ],
    ),
  );
}

export default app;
