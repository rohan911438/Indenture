/**
 * indenture-compile: compile a mandate YAML to { hash, covenants, prompt }.
 *   npm run compile -w @indenture/mandate -- mandates/fund-one.yaml
 *
 * `--canonical` also prints the canonical JSON that was hashed.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { compileMandate } from "./compile.js";

const args = process.argv.slice(2);
const path = args.find((a) => !a.startsWith("--"));
if (!path) {
  console.error("usage: indenture-compile <path-to-mandate.yaml> [--canonical]");
  process.exit(1);
}

// npm sets INIT_CWD to where `npm run` was invoked; under a workspace the
// process cwd is the package dir, so resolve the arg against INIT_CWD first.
const base = process.env.INIT_CWD ?? process.cwd();
const out = compileMandate(readFileSync(resolve(base, path), "utf8"));
console.log(
  JSON.stringify(
    {
      hash: out.hash,
      covenants: {
        maxPositionBps: out.covenantArgs.maxPositionBps.toString(),
        minCashBps: out.covenantArgs.minCashBps.toString(),
        maxTradeNotional: out.covenantArgs.maxTradeNotional.toString(),
        maxDailyNotional: out.covenantArgs.maxDailyNotional.toString(),
      },
      prompt: out.prompt,
      ...(args.includes("--canonical") ? { canonical: out.canonical } : {}),
    },
    null,
    2,
  ),
);
