#!/usr/bin/env node
/**
 * A local JSON-RPC shim that makes Foundry and the Hedera relay agree.
 *
 * THE PROBLEM. `forge script` opens a fork and pins it, and from then on it
 * addresses state with an EIP-1898 block object: `{"blockNumber": "0x..."}`
 * or `{"blockHash": "0x..."}` where a plain tag would otherwise go. The
 * Hedera JSON-RPC relay does not implement EIP-1898. It answers with:
 *
 *   Invalid parameter 1: The value passed is not valid: [object Object]
 *
 * on the SECOND request of the run, before a single transaction is built, so
 * the whole deploy pipeline is unusable against Hedera with no clue as to
 * why. The message never says "EIP-1898" and never names the method.
 *
 * THE FIX. Sit between them and rewrite only that one thing:
 *
 *   {"blockNumber": "0x1234"}  ->  "0x1234"          exactly equivalent
 *   {"blockHash":   "0xabcd"}  ->  "0x1234"          resolved, then cached
 *
 * Everything else is forwarded untouched, including errors. This is a
 * translation, not a policy: the shim never invents a result, never retries a
 * failed call, and never answers a request itself. If the relay is wrong
 * about something, you still see the relay being wrong.
 *
 * WHY NOT just reimplement the deploys in JS. Because the five Foundry
 * scripts are the ones rehearsed end to end on anvil, including the hook
 * address mining and the mandate hash check. Replacing them for the real
 * deploy would mean the thing that was tested is not the thing that runs.
 *
 *   node scripts/hedera-rpc-shim.mjs                        # :8546 -> hashio
 *   node scripts/hedera-rpc-shim.mjs --port 9000 --upstream <url>
 *   node scripts/hedera-rpc-shim.mjs --verbose              # log every method
 *
 * Then point Foundry at it:
 *   forge script script/01_PoolManager.s.sol \
 *     --rpc-url http://127.0.0.1:8546 --legacy --slow --broadcast
 */
import { createServer } from "node:http";

const args = process.argv.slice(2);
const argOf = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const PORT = Number(argOf("--port", "8546"));
const UPSTREAM = argOf("--upstream", "https://testnet.hashio.io/api");
const VERBOSE = args.includes("--verbose");

/**
 * Which argument of which method is a block tag. Anything not listed here is
 * forwarded byte for byte — a shim that guessed would be worse than none.
 */
const BLOCK_PARAM_INDEX = {
  eth_getBalance: 1,
  eth_getCode: 1,
  eth_getTransactionCount: 1,
  eth_call: 1,
  eth_estimateGas: 1,
  eth_getStorageAt: 2,
  eth_getProof: 2,
  eth_createAccessList: 1,
};

/** blockHash -> blockNumber. Blocks are immutable, so this never goes stale. */
const hashToNumber = new Map();

const counts = new Map();
let rewrites = 0;

async function upstream(payload) {
  const res = await fetch(UPSTREAM, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) };
  } catch {
    // A gateway error page, usually rate limiting. Pass it through as-is
    // rather than dressing it up as a JSON-RPC error it never was.
    return { status: res.status, body: { raw: text } };
  }
}

async function resolveBlockHash(hash) {
  const cached = hashToNumber.get(hash);
  if (cached) return cached;
  const { body } = await upstream({
    jsonrpc: "2.0",
    id: `shim-${hash.slice(0, 10)}`,
    method: "eth_getBlockByHash",
    params: [hash, false],
  });
  const number = body?.result?.number;
  if (!number) throw new Error(`cannot resolve block hash ${hash}`);
  hashToNumber.set(hash, number);
  return number;
}

async function normalize(req) {
  if (!req || typeof req !== "object") return req;
  counts.set(req.method, (counts.get(req.method) ?? 0) + 1);
  const index = BLOCK_PARAM_INDEX[req.method];
  if (index === undefined || !Array.isArray(req.params)) return req;

  const param = req.params[index];
  if (!param || typeof param !== "object" || Array.isArray(param)) return req;

  let tag;
  if (typeof param.blockNumber === "string") {
    tag = param.blockNumber;
  } else if (typeof param.blockHash === "string") {
    tag = await resolveBlockHash(param.blockHash);
  } else {
    return req;
  }

  rewrites += 1;
  const params = [...req.params];
  params[index] = tag;
  if (VERBOSE) console.log(`  rewrote ${req.method} block param -> ${tag}`);
  return { ...req, params };
}

const server = createServer((req, res) => {
  if (req.method !== "POST") {
    res.writeHead(405).end("this is a JSON-RPC shim; POST only");
    return;
  }
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", async () => {
    try {
      const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const normalized = Array.isArray(payload)
        ? await Promise.all(payload.map(normalize))
        : await normalize(payload);
      if (VERBOSE && !Array.isArray(normalized)) console.log(normalized.method);
      const { status, body } = await upstream(normalized);
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    } catch (err) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32603, message: `shim: ${err.message}` },
        }),
      );
    }
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`shim listening on http://127.0.0.1:${PORT}  ->  ${UPSTREAM}`);
  console.log("rewriting EIP-1898 block objects; everything else passes through");
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    console.log(`\n${rewrites} block params rewritten. Methods seen:`);
    for (const [method, n] of top) console.log(`  ${String(n).padStart(5)}  ${method}`);
    server.close(() => process.exit(0));
  });
}
