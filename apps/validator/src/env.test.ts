import { describe, it, expect, afterEach } from "vitest";
import { resolveEnv } from "./env.js";
import { lockFor, upstashLock, kvLock, openLock } from "./lock.js";

/**
 * On Vercel `c.env` is undefined, because hono/vercel is
 * `(app) => (req) => app.fetch(req)` with no second argument. If these tests
 * fail, the Vercel deployment answers every request with a 500.
 */
describe("env resolution across hosts", () => {
  const saved = { ...(globalThis as any).process.env };
  afterEach(() => {
    (globalThis as any).process.env = { ...saved };
  });

  it("reads the ambient environment when there are no bindings at all", () => {
    process.env.VALIDATOR_KEY = "0xkey";
    process.env.CHAIN_ID = "296";
    const env = resolveEnv(undefined);
    expect(env.VALIDATOR_KEY).toBe("0xkey");
    expect(env.CHAIN_ID).toBe("296");
  });

  it("prefers a binding over the ambient value", () => {
    process.env.HEDERA_RPC_URL = "https://ambient";
    expect(resolveEnv({ HEDERA_RPC_URL: "https://bound" }).HEDERA_RPC_URL).toBe(
      "https://bound",
    );
  });

  it("treats an empty binding as absent, not as an endpoint", () => {
    // A dashboard field saved blank must not silently become the RPC URL.
    process.env.HEDERA_RPC_URL = "https://ambient";
    expect(resolveEnv({ HEDERA_RPC_URL: "" }).HEDERA_RPC_URL).toBe("https://ambient");
  });

  it("yields empty strings rather than undefined when nothing is set", () => {
    delete process.env.VALIDATOR_KEY;
    expect(resolveEnv({}).VALIDATOR_KEY).toBe("");
  });

  it("carries the KV binding through untouched", () => {
    const cache = { get: async () => null, put: async () => {} };
    expect(resolveEnv({ CACHE: cache }).CACHE).toBe(cache);
  });
});

describe("nonce lock selection", () => {
  const base = {
    VALIDATOR_KEY: "",
    CHAIN_ID: "",
    HEDERA_RPC_URL: "",
    HEDERA_MIRROR_URL: "",
  };

  it("uses the KV binding when Cloudflare provides one", () => {
    const cache = { get: async () => null, put: async () => {} };
    expect(lockFor({ ...base, CACHE: cache }).kind).toBe("kv");
  });

  it("uses Upstash when only REST credentials are present", () => {
    expect(
      lockFor({ ...base, KV_REST_API_URL: "https://u", KV_REST_API_TOKEN: "t" }).kind,
    ).toBe("upstash");
  });

  it("accepts the UPSTASH_ naming as well as the KV_ naming", () => {
    expect(
      lockFor({
        ...base,
        UPSTASH_REDIS_REST_URL: "https://u",
        UPSTASH_REDIS_REST_TOKEN: "t",
      }).kind,
    ).toBe("upstash");
  });

  it("falls back to no lock rather than refusing to run", () => {
    // A Vercel deploy with no Redis is a valid deploy. The journal can show
    // two receipts for one nonce; the chain still accepts only one.
    expect(lockFor(base).kind).toBe("none");
  });

  it("ignores a URL with no token", () => {
    expect(lockFor({ ...base, KV_REST_API_URL: "https://u" }).kind).toBe("none");
  });
});

describe("nonce lock behaviour", () => {
  it("open lock always grants", async () => {
    expect(await openLock().acquire("k", 120)).toBe(true);
  });

  it("KV refuses a key it already holds", async () => {
    const store = new Map<string, string>([["held", "1"]]);
    const lock = kvLock({
      get: async (k) => store.get(k) ?? null,
      put: async (k, v) => void store.set(k, v),
    });
    expect(await lock.acquire("held", 120)).toBe(false);
    expect(await lock.acquire("fresh", 120)).toBe(true);
    expect(store.get("fresh")).toBe("1");
  });

  it("KV grants when the store throws, rather than blocking a good trade", async () => {
    const lock = kvLock({
      get: async () => {
        throw new Error("KV down");
      },
      put: async () => {},
    });
    expect(await lock.acquire("k", 120)).toBe(true);
  });

  it("Upstash sends SET NX with a TTL and reads OK as taken", async () => {
    let seen = "";
    const fetchSpy = async (url: string | URL | Request, init?: RequestInit) => {
      seen = String(url);
      expect(init?.method).toBe("POST");
      return new Response(JSON.stringify({ result: "OK" }));
    };
    const original = globalThis.fetch;
    globalThis.fetch = fetchSpy as typeof fetch;
    try {
      const lock = upstashLock("https://example.upstash.io/", "tok");
      expect(await lock.acquire("nonce:0xv:7", 120)).toBe(true);
      expect(seen).toContain("/set/nonce%3A0xv%3A7/1");
      expect(seen).toContain("NX=true");
      expect(seen).toContain("EX=120");
      expect(seen).not.toContain("//set");
    } finally {
      globalThis.fetch = original;
    }
  });

  it("Upstash reads a null result as already held", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ result: null }))) as typeof fetch;
    try {
      expect(await upstashLock("https://u", "t").acquire("k", 120)).toBe(false);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("Upstash grants when the service is unreachable", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error("network");
    }) as typeof fetch;
    try {
      expect(await upstashLock("https://u", "t").acquire("k", 120)).toBe(true);
    } finally {
      globalThis.fetch = original;
    }
  });
});
