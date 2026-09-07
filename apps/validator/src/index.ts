import { Hono } from "hono";
import { cors } from "hono/cors";
import { type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { signReceipt, type Receipt } from "@indenture/receipt";
import { makeEnvelope } from "@indenture/hedera/envelope";
import { validateRequestSchema } from "./schema.js";
import { runCovenantChecks } from "./checks.js";
import { MockSources, paramsHashOf, type Sources } from "./sources.js";
import { MirrorSources, mirrorConfigFrom } from "./mirror-sources.js";
import deployments from "../../../contracts/deployments.json";

type Bindings = {
  VALIDATOR_KEY: string; // wrangler secret
  CHAIN_ID: string;
  HEDERA_RPC_URL: string;
  HEDERA_MIRROR_URL: string;
  CACHE?: KVNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();

/**
 * The prospectus is a static site on another origin, and its attack console
 * calls /validate directly from the browser. Without this the call never
 * leaves the page.
 *
 * A wildcard origin is the honest setting here: every endpoint is public and
 * read-only from the caller's point of view. /validate signs nothing the
 * caller chose — the seq comes from MandatePolicy, the mandate from HCS, the
 * prices from Chainlink — so an origin check would suggest a boundary that
 * does not exist. The real boundary is the request schema and the chain.
 */
app.use(
  "/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["content-type"],
    maxAge: 86400,
  }),
);

const RECEIPT_TTL_SEC = 120;

/**
 * THE seam (mock-status.md row 3). MirrorSources the moment deployments.json
 * is populated; MockSources until then.
 *
 * The switch is on the DATA, not on an env flag, deliberately: a flag can be
 * set wrong in one environment and leave the Validator quietly deciding on
 * fixture numbers against a real fund. If the addresses are not there, there is
 * genuinely nothing to read, and saying so is honest. If they are there, there
 * is no reason to prefer a mock.
 */
function sourcesFor(env: Bindings): Sources {
  const cfg = mirrorConfigFrom(deployments);
  if (!cfg) return new MockSources();
  return new MirrorSources({
    ...cfg,
    rpcUrl: env.HEDERA_RPC_URL || cfg.rpcUrl,
    mirrorUrl: env.HEDERA_MIRROR_URL || cfg.mirrorUrl,
  });
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
      feedStaleAfterSec: m.feedStaleAfterSec,
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

  // --- covenants ---------------------------------------------------------
  // Checked BEFORE the nonce lock is taken. Taking the lock first meant a
  // refused proposal held the nonce for the full 120s TTL, so one bad
  // proposal blocked the next legitimate one — during a demo that fires an
  // attack and then a good trade, that reads as the system breaking.
  const inputs = await src.covenantInputs(req, m);
  const checks = runCovenantChecks(inputs);
  if (!checks.ok) {
    return refuse(`${checks.covenant}: ${checks.reason}`, {
      covenant: checks.covenant,
      ...checks.detail,
    });
  }

  // --- single-flight nonce lock ------------------------------------------
  // Best-effort only, and deliberately so. Workers KV has no compare-and-set,
  // so two concurrent requests can both read empty and both sign for the same
  // seq. That is not a fund-safety problem: MandatePolicy.seqOf is the real
  // anti-replay boundary and only one of them can ever land on chain. This
  // lock exists to keep the JOURNAL clean — two signed receipts for one nonce
  // is exactly the kind of thing the journal is supposed to make unambiguous.
  // Do not mistake it for a security control.
  const lockKey = `nonce:${binding.vault}:${binding.seq}`;
  if (c.env.CACHE) {
    const held = await c.env.CACHE.get(lockKey);
    if (held) {
      return refuse("nonce in flight", { seq: Number(binding.seq), lockKey });
    }
    await c.env.CACHE.put(lockKey, "1", { expirationTtl: RECEIPT_TTL_SEC });
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
