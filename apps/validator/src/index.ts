import { Hono } from "hono";
import { type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { signReceipt, type Receipt } from "@indenture/receipt";
import { makeEnvelope } from "@indenture/hedera/envelope";
import { validateRequestSchema } from "./schema.js";
import { runCovenantChecks } from "./checks.js";
import { MockSources, paramsHashOf, type Sources } from "./sources.js";

type Bindings = {
  VALIDATOR_KEY: string; // wrangler secret
  CHAIN_ID: string;
  HEDERA_RPC_URL: string;
  HEDERA_MIRROR_URL: string;
  CACHE?: KVNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();

const RECEIPT_TTL_SEC = 120;

/** Swap this for MirrorSources when the real derivation lands (build step 7). */
function sourcesFor(_env: Bindings): Sources {
  return new MockSources();
}

// --------------------------------------------------------------------------
// GET /health  - never signs, never touches KV, safe to poll
// --------------------------------------------------------------------------
app.get("/health", async (c) => {
  const src = sourcesFor(c.env);
  let validator: string | null = null;
  try {
    validator = privateKeyToAccount(c.env.VALIDATOR_KEY as Hex).address;
  } catch {
    validator = null;
  }
  let mandateSeq: number | null = null;
  let feedAgeSeconds: number | null = null;
  try {
    const m = await src.mandate();
    mandateSeq = m.seq;
    feedAgeSeconds = await src.oldestFeedAgeSec(m);
  } catch {
    /* leave nulls */
  }
  return c.json({
    ok: true,
    service: "indenture-validator",
    validator,
    mandateSeq,
    feedAgeSeconds,
    chainId: Number(c.env.CHAIN_ID),
  });
});

// --------------------------------------------------------------------------
// GET /mandate  - the rulebook the Validator is currently enforcing
// --------------------------------------------------------------------------
app.get("/mandate", async (c) => {
  const m = await sourcesFor(c.env).mandate();
  return c.json({
    yaml: m.yaml,
    mandateHash: m.mandateHash,
    seq: m.seq,
    covenants: {
      maxPositionBps: Number(m.limits.maxPositionBps),
      minCashBps: Number(m.limits.minCashBps),
      maxTradeNotional: m.limits.maxTradeNotional.toString(),
      maxDailyNotional: m.limits.maxDailyNotional.toString(),
    },
  });
});

// --------------------------------------------------------------------------
// POST /validate  - the trade boundary. body is EXACTLY { poolId, swapParams }.
// A refusal is a normal 200. A 4xx means only "your request was malformed".
// --------------------------------------------------------------------------
app.post("/validate", async (c) => {
  const parsed = validateRequestSchema.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success) {
    return c.json(
      { decision: "REFUSED", reason: "bad request shape", issues: parsed.error.issues },
      400,
    );
  }
  const req = parsed.data;
  const src = sourcesFor(c.env);

  const [m, binding] = await Promise.all([src.mandate(), src.binding()]);
  const ph = paramsHashOf(req);

  const refuse = (reason: string, detail: Record<string, unknown>) => {
    const journal = makeEnvelope({
      type: "RECEIPT",
      vault: binding.vault,
      body: {
        decision: "REFUSED",
        reason,
        mandateHash: m.mandateHash,
        poolId: req.poolId,
        paramsHash: ph,
        seq: Number(binding.seq),
      },
    });
    return c.json({ decision: "REFUSED", reason, detail, journal });
  };

  // --- single-flight nonce lock (Workers KV, TTL = receipt TTL) ------------
  const lockKey = `nonce:${binding.vault}:${binding.seq}`;
  if (c.env.CACHE) {
    const held = await c.env.CACHE.get(lockKey);
    if (held) {
      return refuse("nonce in flight", { seq: Number(binding.seq), lockKey });
    }
    await c.env.CACHE.put(lockKey, "1", { expirationTtl: RECEIPT_TTL_SEC });
  }

  // --- covenants ---------------------------------------------------------
  const inputs = await src.covenantInputs(req, m);
  const checks = runCovenantChecks(inputs);
  if (!checks.ok) {
    return refuse(`${checks.covenant}: ${checks.reason}`, {
      covenant: checks.covenant,
      ...checks.detail,
    });
  }

  // --- sign ------------------------------------------------------------
  const receipt: Receipt = {
    mandateHash: m.mandateHash,
    poolId: req.poolId as Hex,
    paramsHash: ph,
    seq: binding.seq,
    deadline: BigInt(Math.floor(Date.now() / 1000) + RECEIPT_TTL_SEC),
    vault: binding.vault,
  };

  const signed = await signReceipt({
    receipt,
    chainId: Number(c.env.CHAIN_ID),
    verifyingContract: binding.mandatePolicy,
    privateKey: c.env.VALIDATOR_KEY as Hex,
  });

  const journal = makeEnvelope({
    type: "RECEIPT",
    vault: binding.vault,
    body: {
      decision: "APPROVED",
      reason: "covenants satisfied",
      mandateHash: m.mandateHash,
      poolId: req.poolId,
      paramsHash: ph,
      seq: Number(binding.seq),
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
    snapshot: checks.snapshot,
    journal,
  });
});

export default app;
