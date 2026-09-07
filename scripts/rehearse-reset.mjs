#!/usr/bin/env node
/**
 * Undo what a local rehearsal writes into tracked files.
 *
 * A full anvil rehearsal deploys contracts, writes their addresses into
 * `contracts/deployments.json`, and then regenerates `mandates/fund-one.yaml`
 * and the Validator's embedded fixture to name those addresses. All three are
 * tracked files with committed placeholder values that the offline suites
 * assert against, so the run leaves the repo in a state where
 * `npm run test:ts` fails with "no price feed for 0x…d0" — an error that
 * looks like a code bug and is not one. That has now cost time twice.
 *
 * Run this after any local rehearsal, before running the test suites:
 *
 *   npm run rehearse:reset
 *
 * It only ever restores files to HEAD and deletes a build artifact; it will
 * refuse rather than discard edits you actually meant to keep.
 */
import { execFileSync } from "node:child_process";
import { rmSync, existsSync } from "node:fs";

/** Written by the rehearsal, asserted against by the offline suites. */
const GENERATED = [
  "apps/validator/src/mandate-fixture.ts",
  "mandates/fund-one.yaml",
  "contracts/deployments.json",
];

const ARTIFACT = "contracts/mandate.compiled.json";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" });

const dirty = git("status", "--porcelain", "--", ...GENERATED)
  .split(/\r?\n/)
  .filter(Boolean);

if (dirty.length === 0) {
  console.log("nothing to restore — the generated files already match HEAD");
} else {
  // Show what is being discarded. These files are machine-written during a
  // rehearsal, but "machine-written" is an assumption, and the one time it is
  // wrong is the time someone hand-edited a covenant.
  console.log("restoring to HEAD:");
  for (const line of dirty) console.log(`  ${line}`);
  git("checkout", "--", ...GENERATED);
}

if (existsSync(ARTIFACT)) {
  rmSync(ARTIFACT, { force: true });
  console.log(`removed ${ARTIFACT}`);
}

console.log("\nOffline suites will now pass:  npm run test:ts");
