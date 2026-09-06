import { parse as parseYaml } from "yaml";
import { canonicalize } from "json-canonicalize";
import { keccak256, toHex, type Hex } from "viem";
import { mandateSchema, type Mandate } from "./schema.js";
import { buildManagerPrompt } from "./prompt.js";

export type CompiledMandate = {
  mandate: Mandate;
  canonical: string;
  /** keccak256(utf8 canonical JSON) - the single agreed-upon mandateHash */
  hash: Hex;
  /** covenant params in the exact shape MandatePolicy.amend() expects.
   *  feedStaleAfterSec is deliberately NOT here: staleness is judged off-chain
   *  by the Validator and never reaches the hook (design rule 4). */
  covenantArgs: {
    maxPositionBps: bigint;
    minCashBps: bigint;
    maxTradeNotional: bigint;
    maxDailyNotional: bigint;
  };
  /** Validator-only: price-feed staleness tolerance, seconds. */
  feedStaleAfterSec: number;
  /** deterministic portfolio-manager system prompt (advisory; never trusted) */
  prompt: string;
};

export function compileMandate(yamlText: string): CompiledMandate {
  const raw = parseYaml(yamlText);
  const mandate = mandateSchema.parse(raw);
  const canonical = canonicalize(mandate);
  const hash = keccak256(toHex(canonical));
  return {
    mandate,
    canonical,
    hash,
    covenantArgs: {
      maxPositionBps: BigInt(mandate.covenants.maxPositionBps),
      minCashBps: BigInt(mandate.covenants.minCashBps),
      maxTradeNotional: BigInt(mandate.covenants.maxTradeNotional),
      maxDailyNotional: BigInt(mandate.covenants.maxDailyNotional),
    },
    feedStaleAfterSec: mandate.covenants.feedStaleAfterSec,
    prompt: buildManagerPrompt(mandate),
  };
}
