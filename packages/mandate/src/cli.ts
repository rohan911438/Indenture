/**
 * Compile a mandate YAML to its canonical form + hash.
 *   npm run compile -w @indenture/mandate -- mandates/fund-one.yaml
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { compileMandate } from "./compile.js";

const path = process.argv[2];
if (!path) {
  console.error("usage: compile <path-to-mandate.yaml>");
  process.exit(1);
}

const out = compileMandate(readFileSync(resolve(path), "utf8"));
console.log(
  JSON.stringify(
    {
      hash: out.hash,
      canonical: out.canonical,
      covenantArgs: {
        maxPositionBps: out.covenantArgs.maxPositionBps.toString(),
        minCashBps: out.covenantArgs.minCashBps.toString(),
        maxTradeNotional: out.covenantArgs.maxTradeNotional.toString(),
        maxDailyNotional: out.covenantArgs.maxDailyNotional.toString(),
      },
    },
    null,
    2,
  ),
);
