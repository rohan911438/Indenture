#!/usr/bin/env node
/**
 * Rewrite the mandate YAML from contracts/deployments.json.
 *
 * mock-status.md row 11: `mandates/fund-one.yaml` ships with 0x…d0 / 0x…b0
 * placeholders so the offline suite is deterministic. After a deploy those
 * addresses are wrong, and a mandate that names addresses which do not exist
 * is worse than no mandate — the Validator would price a portfolio it cannot
 * see and fail closed on every proposal, with a staleness reason that points
 * nowhere near the actual cause.
 *
 * This regenerates the vault / quote / universe / priceFeeds entries in place,
 * leaving the covenants exactly as the fund author wrote them. Covenants are a
 * human decision; addresses are a deployment fact. Only the second kind is
 * safe to generate.
 *
 * Usage:
 *   node scripts/regen-mandate.mjs [--deployments <path>] [--out <path>]
 *
 * After running it you MUST re-compile and re-`amend()`, because the mandate
 * hash has changed and in-flight receipts are bound to the old one:
 *   npm run compile -w @indenture/mandate -- mandates/fund-one.yaml
 *   forge script script/04_Wire.s.sol ...
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const argOf = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const root = process.env.INIT_CWD ?? process.cwd();
const deploymentsPath = resolve(root, argOf("--deployments", "contracts/deployments.json"));
const outPath = resolve(root, argOf("--out", "mandates/fund-one.yaml"));

const d = JSON.parse(readFileSync(deploymentsPath, "utf8"));

const vault = d.contracts?.IndentureVault;
const usdc = d.contracts?.MockUSDC;
const asset = d.contracts?.MockAsset;
const feed = d.contracts?.ChainlinkPriceFeed;

const missing = Object.entries({ IndentureVault: vault, MockUSDC: usdc, MockAsset: asset })
  .filter(([, v]) => !v)
  .map(([k]) => k);
if (missing.length) {
  console.error(`deployments.json is missing: ${missing.join(", ")}`);
  console.error("Run the deploy scripts first.");
  process.exit(1);
}
if (!feed) {
  console.error("ChainlinkPriceFeed is unset.");
  console.error(
    "On Hedera testnet use a real Chainlink feed (see docs/RESEARCH.md 1.3); on anvil run 05_Liquidity.s.sol.",
  );
  process.exit(1);
}

const src = readFileSync(outPath, "utf8");
const lines = src.split(/\r?\n/);
const out = [];

// Rewrite only the address-bearing lines; covenants and comments pass through
// untouched so a hand-authored mandate keeps its shape and its explanations.
for (const line of lines) {
  if (/^vault:/.test(line)) {
    out.push(`vault: "${vault}"   # IndentureVault`);
  } else if (/^quote:/.test(line)) {
    out.push(`quote: "${usdc}"   # MockUSDC, 6dp — the cash reserve`);
  } else {
    out.push(line);
  }
}

let text = out.join("\n");

// universe + priceFeeds are whole blocks, so replace them wholesale rather
// than line by line.
text = text.replace(
  /universe:\n(?:\s*(?:#[^\n]*|-[^\n]*)\n)+/,
  `universe:\n  - "${asset}"   # the risk asset\n`,
);
text = text.replace(
  /priceFeeds:\n(?:\s*(?:#[^\n]*|"0x[^\n]*)\n?)+/,
  `priceFeeds:\n  # asset -> Chainlink AggregatorV3 feed. Read by the Validator ONLY.\n  "${asset}": "${feed}"\n`,
);

writeFileSync(outPath, text.endsWith("\n") ? text : `${text}\n`, "utf8");

// Keep the Worker's embedded fixture in step. mock-status.md row 4 says these
// must not drift, and "must not drift" enforced by a human is a bug waiting to
// happen — the Validator would sign against one mandate while the chain
// enforced another, and the hash mismatch would surface as StaleMandate on the
// first trade with no hint of why.
const fixturePath = resolve(root, "apps/validator/src/mandate-fixture.ts");
try {
  const fixture = readFileSync(fixturePath, "utf8");
  const rewritten = fixture.replace(
    /export const MANDATE_YAML_FIXTURE = `[\s\S]*?`;/,
    "export const MANDATE_YAML_FIXTURE = `" +
      text.replaceAll("`", "\\`").replaceAll("${", "\\${") +
      "`;",
  );
  writeFileSync(fixturePath, rewritten, "utf8");
  console.log(`rewrote ${fixturePath}`);
} catch (e) {
  console.warn(`could not sync the validator fixture: ${e.message}`);
}

console.log(`rewrote ${outPath}`);
console.log(`  vault  ${vault}`);
console.log(`  quote  ${usdc}`);
console.log(`  asset  ${asset}`);
console.log(`  feed   ${feed}`);
console.log("\nThe mandate hash has changed. Re-compile and re-amend() before trading.");
