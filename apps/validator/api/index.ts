/**
 * Vercel entry point. The Cloudflare entry is `src/index.ts` itself, which
 * Wrangler takes as its `main`; this file exists only because Vercel wants a
 * function under `api/` and a named export per HTTP method.
 *
 * Both hosts run the SAME Hono app. Nothing about a decision — what is read,
 * what is checked, what is signed — differs between them. The only real
 * difference is where configuration comes from (see src/env.ts) and whether a
 * nonce lock exists (see src/lock.ts), and both are handled inside the app.
 *
 * Runtime is Node, not Edge, on purpose: the Edge bundle ceiling on the free
 * plan is tight and viem is not small. Nothing here needs Edge, because
 * nothing here is latency-critical enough to notice. If you do want Edge,
 * add `export const runtime = "edge";` below and redeploy.
 */
import { handle } from "hono/vercel";
import app from "../src/index.js";

const handler = handle(app);

export const GET = handler;
export const POST = handler;
export const OPTIONS = handler;
