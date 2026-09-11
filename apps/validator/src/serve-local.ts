/**
 * Run the Validator on a local port, against whatever is in deployments.json.
 *
 *   npm run dev:node -w @indenture/validator     # http://127.0.0.1:8787
 *
 * `wrangler dev` is the Cloudflare way and `vercel dev` the Vercel way; this
 * is neither, and exists because driving a real testnet trade from a laptop
 * needs the Validator reachable over HTTP with the repo's own .env loaded, and
 * neither of those two does that without also emulating a platform we are not
 * deploying to at that moment. The app is byte-identical either way: this file
 * only adapts Node's http server to fetch.
 *
 * It reads VALIDATOR_KEY from the environment like every other host does, so
 * export the repo .env before running it and never commit a key here.
 */
import { createServer } from "node:http";
import app from "./index.js";

const PORT = Number(process.env.PORT ?? 8787);

createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const hasBody = req.method !== "GET" && req.method !== "HEAD";

  const response = await app.fetch(
    new Request(`http://127.0.0.1:${PORT}${req.url ?? "/"}`, {
      method: req.method,
      headers: req.headers as Record<string, string>,
      body: hasBody && chunks.length ? Buffer.concat(chunks) : undefined,
    }),
  );

  // forEach rather than Object.fromEntries: this package typechecks against
  // workers-types, whose Headers is not declared iterable.
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  res.writeHead(response.status, headers);
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(PORT, "127.0.0.1", () => {
  console.log(`validator on http://127.0.0.1:${PORT}  (GET /health to check)`);
});
