import type { ValidatorEnv } from "./env.js";

/**
 * The single-flight nonce lock, and what it is not.
 *
 * MandatePolicy.seqOf is the real anti-replay boundary: two receipts signed
 * for one seq cannot both land on chain. This lock exists so the JOURNAL does
 * not show two signatures for one nonce, which is exactly the ambiguity the
 * journal is meant to remove. It is a tidiness control, not a safety one, and
 * nothing here should ever be described as the latter.
 *
 * That is why every implementation FAILS OPEN. If the lock store is
 * unreachable, the Validator signs. Refusing a legitimate trade because a
 * cache was down would turn a cosmetic dependency into an outage.
 */
export interface NonceLock {
  /** True if this caller took the lock. False only if someone else holds it. */
  acquire(key: string, ttlSeconds: number): Promise<boolean>;
  /** For /health and for saying plainly on which host the journal can double. */
  readonly kind: "kv" | "upstash" | "none";
}

/** Cloudflare Workers KV. Read-then-write, so genuinely racy — see below. */
export function kvLock(cache: NonNullable<ValidatorEnv["CACHE"]>): NonceLock {
  return {
    kind: "kv",
    async acquire(key, ttlSeconds) {
      try {
        // KV has no compare-and-set. Two concurrent requests can both read
        // empty and both proceed. Narrows the window; does not close it.
        if (await cache.get(key)) return false;
        await cache.put(key, "1", { expirationTtl: ttlSeconds });
        return true;
      } catch {
        return true;
      }
    },
  };
}

/** Upstash Redis over REST. SET NX is atomic, so this one actually closes it. */
export function upstashLock(url: string, token: string): NonceLock {
  const base = url.replace(/\/+$/, "");
  return {
    kind: "upstash",
    async acquire(key, ttlSeconds) {
      try {
        const res = await fetch(
          `${base}/set/${encodeURIComponent(key)}/1?NX=true&EX=${ttlSeconds}`,
          { method: "POST", headers: { authorization: `Bearer ${token}` } },
        );
        if (!res.ok) return true;
        const body = (await res.json()) as { result?: unknown };
        // "OK" means we set it. null means someone else already had it.
        return body.result !== null;
      } catch {
        return true;
      }
    },
  };
}

/** No store configured. Honest no-op: everyone gets the lock. */
export function openLock(): NonceLock {
  return { kind: "none", acquire: async () => true };
}

/**
 * Pick a lock from whatever the host provides.
 *
 * Order matters only in that a real binding beats a URL in an environment
 * variable. On Vercel with no Upstash integration this returns the open lock,
 * and the deployment is still correct — see the note at the top of the file.
 */
export function lockFor(env: ValidatorEnv): NonceLock {
  if (env.CACHE) return kvLock(env.CACHE);
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return upstashLock(url, token);
  return openLock();
}
