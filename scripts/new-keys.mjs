#!/usr/bin/env node
/**
 * Generate the two throwaway EVM keys the deploy needs, straight into `.env`.
 *
 * `cast wallet new` does the same job in one line, but it PRINTS the private
 * key. On a shared screen, in a scrollback buffer, in a terminal that is being
 * recorded for a demo, that is exactly the wrong place for the key that signs
 * every receipt this fund issues. This writes the keys to `.env` and prints
 * only the addresses, which are public by definition.
 *
 * It refuses to write unless `.env` is actually gitignored, and it refuses to
 * overwrite a key that is already real. Both refusals are the point.
 *
 *   node scripts/new-keys.mjs            # fill in whatever is missing
 *   node scripts/new-keys.mjs --force    # replace existing keys (rotation)
 *
 * VALIDATOR_KEY  signs EIP-712 receipts. Goes into ONE hosted environment.
 *                Never into CI, never into the browser, never committed.
 * MANAGER_KEY    the untrusted proposer. Assume it is stolen: it can only
 *                submit trades the Validator already signed and the hook
 *                re-checks. It needs a little testnet HBAR to pay for gas.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env");
const examplePath = resolve(root, ".env.example");
const force = process.argv.includes("--force");

// --- refuse to write a secret into a tracked file --------------------------
// `git check-ignore` exits 0 when the path IS ignored. Anything else, and we
// are one `git add .` away from publishing the key that signs every receipt.
try {
  execFileSync("git", ["check-ignore", "-q", ".env"], { cwd: root });
} catch {
  console.error(
    ".env is NOT gitignored. Refusing to write a private key into a file git\n" +
      "would happily commit. Add `.env` to .gitignore and run this again.",
  );
  process.exit(1);
}

if (!existsSync(envPath)) {
  if (!existsSync(examplePath)) {
    console.error("Neither .env nor .env.example exists. Nothing to build on.");
    process.exit(1);
  }
  copyFileSync(examplePath, envPath);
  console.log("created .env from .env.example");
}

let text = readFileSync(envPath, "utf8");

/**
 * The placeholders in .env.example are deliberately obvious 0x…01 / 0x…02
 * values. Anything else is treated as a real key and left alone unless
 * --force, because silently rotating a key that is already deployed would
 * leave the Vercel environment signing with one key and the chain expecting
 * another, surfacing as BadSignature on the next trade and nowhere else.
 */
const isPlaceholder = (value) =>
  value === "" || /^0x0{40,}[0-9a-f]{0,24}$/i.test(value) || value.startsWith("0xac0974be");

function currentValue(name) {
  const m = text.match(new RegExp(`^${name}=(.*)$`, "m"));
  return m ? m[1].trim() : null;
}

function setValue(name, value) {
  const line = `${name}=${value}`;
  text = text.match(new RegExp(`^${name}=.*$`, "m"))
    ? text.replace(new RegExp(`^${name}=.*$`, "m"), line)
    : `${text.replace(/\n*$/, "\n")}${line}\n`;
}

const results = [];
for (const name of ["VALIDATOR_KEY", "MANAGER_KEY"]) {
  const existing = currentValue(name);
  if (existing !== null && !isPlaceholder(existing) && !force) {
    results.push([name, privateKeyToAccount(existing).address, "kept"]);
    continue;
  }
  const key = generatePrivateKey();
  setValue(name, key);
  results.push([name, privateKeyToAccount(key).address, force && existing ? "rotated" : "new"]);
}

writeFileSync(envPath, text, "utf8");

console.log("\nWritten to .env. The private keys are not printed anywhere.\n");
for (const [name, address, state] of results) {
  console.log(`  ${name.padEnd(14)} ${address}  (${state})`);
}
console.log(`
Next:
  1. VALIDATOR_ADDRESS and MANAGER_ADDRESS above go into the deploy env
     (DEPLOY.md step 3). They are public. Paste them anywhere.
  2. Fund the MANAGER address with a little testnet HBAR. It pays gas.
     The VALIDATOR address never needs funding; it only signs.
  3. Copy VALIDATOR_KEY's VALUE out of .env into the Vercel environment once,
     marked Sensitive. That is the only copy that should exist off this
     machine.  MANAGER_KEY goes into GitHub Actions secrets.`);
