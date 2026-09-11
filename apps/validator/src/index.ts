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
import { resolveEnv, type ValidatorEnv } from "./env.js";
import { lockFor } from "./lock.js";
import deployments from "../../../contracts/deployments.json";

/**
 * Bindings are PARTIAL on purpose. On Cloudflare they arrive full; on Vercel
 * there are none at all and every value comes from the ambient environment.
 * `resolveEnv` is the only place that difference is allowed to matter.
 *
 * The deployment document is a PARAMETER rather than a module-level import,
 * because the seam below reads it to decide between live and mock sources.
 * Once a real fund is deployed, `contracts/deployments.json` is populated and
 * the offline suites would silently start talking to testnet — slow, flaky,
 * and asserting against a chain that moves. Tests pass an empty document and
 * get the mock sources deterministically. Nothing at runtime passes anything.
 */
type DeploymentDoc = Parameters<typeof mirrorConfigFrom>[0];

export function createApp(deploymentDoc: DeploymentDoc = deployments) {
const app = new Hono<{ Bindings: Partial<ValidatorEnv> }>();

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
function sourcesFor(env: ValidatorEnv): Sources {
  const cfg = mirrorConfigFrom(deploymentDoc);
  if (!cfg) return new MockSources();
  return new MirrorSources({
    ...cfg,
    rpcUrl: env.HEDERA_RPC_URL || cfg.rpcUrl,
    mirrorUrl: env.HEDERA_MIRROR_URL || cfg.mirrorUrl,
  });
}

// --------------------------------------------------------------------------
// GET /health  - never signs, never takes the nonce lock, safe to poll
// --------------------------------------------------------------------------
app.get("/health", async (c) => {
  const env = resolveEnv(c.env);
  const src = sourcesFor(env);
  let validator: string | null = null;
  try {
    validator = privateKeyToAccount(env.VALIDATOR_KEY as Hex).address;
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
    chainId: Number(env.CHAIN_ID),
    // Says out loud whether the journal can show two receipts for one nonce.
    nonceLock: lockFor(env).kind,
  });
});

// --------------------------------------------------------------------------
// GET /mandate  - the rulebook the Validator is currently enforcing
// --------------------------------------------------------------------------
app.get("/mandate", async (c) => {
  const m = await sourcesFor(resolveEnv(c.env)).mandate();
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
  const env = resolveEnv(c.env);
  const src = sourcesFor(env);

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
  // Best-effort, and deliberately so. See lock.ts: this keeps the JOURNAL
  // unambiguous, and MandatePolicy.seqOf remains the real anti-replay
  // boundary. Every implementation fails open. Do not mistake it for a
  // security control.
  const lockKey = `nonce:${binding.vault}:${binding.seq}`;
  if (!(await lockFor(env).acquire(lockKey, RECEIPT_TTL_SEC))) {
    return refuse("nonce in flight", { seq: Number(binding.seq), lockKey });
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
    chainId: Number(env.CHAIN_ID),
    verifyingContract: binding.mandatePolicy,
    privateKey: env.VALIDATOR_KEY as Hex,
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

return app;
}

export default createApp();
