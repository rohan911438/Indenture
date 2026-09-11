/**
 * Reading the repository's own view of the deployment.
 *
 * Extracted from index.ts because the adversarial harness needs exactly the
 * same view. It previously carried its own hardcoded pool id and trade sizes,
 * calibrated against the mock fund, and against a real deployment every one
 * of them was a rounding error: the "drain the fund" attack asked to sell
 * 0.001 tokens and was correctly approved. A demo whose main stage shows
 * APPROVED for an attack is worse than no demo.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { compileMandate } from "@indenture/mandate";
import type { Hex } from "viem";
import {
  MockFundStateProvider,
  MirrorFundStateProvider,
  type FundStateProvider,
} from "./fund-state.js";

export type DeploymentsFile = {
  network?: { rpcUrl?: string; chainId?: number };
  contracts?: Record<string, string>;
  pool?: {
    poolId?: string;
    currency0?: string;
    currency1?: string;
    fee?: number;
    tickSpacing?: number;
    quoteIsCurrency0?: boolean;
  };
  hcs?: Record<string, string>;
};

/** deployments.json is the single source of truth. Never read an address from env. */
export function loadDeployments(): DeploymentsFile {
  try {
    const base = process.env.INIT_CWD ?? process.cwd();
    return JSON.parse(
      readFileSync(resolve(base, "contracts/deployments.json"), "utf8"),
    ) as DeploymentsFile;
  } catch {
    try {
      return JSON.parse(
        readFileSync(resolve(process.cwd(), "../../contracts/deployments.json"), "utf8"),
      ) as DeploymentsFile;
    } catch {
      return {};
    }
  }
}

/** The committed mandate, compiled. Null when it cannot be read at all. */
export function loadMandate(): ReturnType<typeof compileMandate> | null {
  try {
    const base = process.env.INIT_CWD ?? process.cwd();
    return compileMandate(readFileSync(resolve(base, "mandates/fund-one.yaml"), "utf8"));
  } catch {
    return null;
  }
}

/**
 * mock-status.md row 6. Switches on the DATA, like the Validator's own seam:
 * if deployments.json has no addresses there is genuinely nothing to read.
 *
 * Being wrong here is cheap — this view is advisory and the Validator
 * re-derives everything independently — so it falls back quietly rather than
 * failing the tick.
 */
export function stateProvider(): FundStateProvider {
  const dep = loadDeployments();
  const vault = dep.contracts?.IndentureVault;
  const poolId = dep.pool?.poolId;
  if (!vault || !poolId) return new MockFundStateProvider();

  const compiled = loadMandate();
  if (!compiled) return new MockFundStateProvider();

  return new MirrorFundStateProvider({
    rpcUrl: dep.network?.rpcUrl ?? "https://testnet.hashio.io/api",
    poolId,
    vault: vault as Hex,
    quote: compiled.mandate.quote as Hex,
    priceFeeds: compiled.mandate.priceFeeds,
    feedStaleAfterSec: compiled.feedStaleAfterSec,
    // Advisory only. The Validator re-derives both from the mandate on the
    // topic and never trusts what the Manager was told.
    maxPositionBps: Number(compiled.covenantArgs.maxPositionBps),
    maxTradeNotional: compiled.covenantArgs.maxTradeNotional.toString(),
    quoteIsCurrency0: Boolean(dep.pool?.quoteIsCurrency0),
  });
}
