/**
 * Where the Validator's configuration comes from, on either host.
 *
 * Cloudflare hands config to the app as request bindings, so every value
 * arrives on `c.env`. Vercel has no equivalent: `hono/vercel` is literally
 * `(app) => (req) => app.fetch(req)`, with no second argument, so `c.env` is
 * `undefined` and everything must come from `process.env` instead.
 *
 * Reading only one of the two is the difference between a Validator that
 * signs and one that answers every request with a 500 that says nothing.
 * Bindings win where both exist, because a binding is explicit to a request
 * and an ambient environment variable is not.
 */

/** Cloudflare's KV binding, narrowed to the two calls the nonce lock makes. */
export interface CacheBinding {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export interface ValidatorEnv {
  /** Signs EIP-712 receipts. Secret. Never in the repo, CI log, or browser. */
  VALIDATOR_KEY: string;
  CHAIN_ID: string;
  HEDERA_RPC_URL: string;
  HEDERA_MIRROR_URL: string;
  /** Cloudflare only. Absent on Vercel; see lock.ts for what that costs. */
  CACHE?: CacheBinding;
  /** Vercel's Upstash integration, either naming. Both optional. */
  KV_REST_API_URL?: string;
  KV_REST_API_TOKEN?: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
}

/** Not `process.env` directly: this file typechecks against workers-types. */
function ambient(): Record<string, string | undefined> {
  const g = globalThis as { process?: { env?: Record<string, string | undefined> } };
  return g.process?.env ?? {};
}

const STRINGS = [
  "VALIDATOR_KEY",
  "CHAIN_ID",
  "HEDERA_RPC_URL",
  "HEDERA_MIRROR_URL",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
] as const;

/**
 * Merge the request bindings over the ambient environment.
 *
 * An empty string counts as absent. Both hosts have a dashboard field that
 * is easy to save blank, and a blank RPC URL should fall through to the
 * other source rather than silently become the endpoint.
 */
export function resolveEnv(bindings?: Partial<ValidatorEnv>): ValidatorEnv {
  const env = ambient();
  const out: Record<string, unknown> = {};
  for (const key of STRINGS) {
    const bound = bindings?.[key];
    out[key] = (typeof bound === "string" && bound.length > 0 ? bound : env[key]) ?? "";
  }
  if (bindings?.CACHE) out.CACHE = bindings.CACHE;
  return out as unknown as ValidatorEnv;
}
