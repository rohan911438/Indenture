import { z } from "zod";
import type { FundState, Proposal, Proposer } from "./proposer.js";

/**
 * LLM-backed proposer. Bring your own free-tier key (LLM_API_KEY) and any
 * OpenAI-compatible /chat/completions endpoint (LLM_BASE_URL, LLM_MODEL).
 * The model output is parsed into {poolId, swapParams} + reasoning; malformed
 * output THROWS so the caller falls back to RuleProposer.
 *
 * SECURITY NOTE: this component is assumed compromised. Nothing here is
 * trusted. The prompt, the model, and the key can all be adversarial - the
 * Validator (which re-derives every fact) and the on-chain hook are what
 * actually protect the fund. This class deliberately never sees the mandate
 * covenants as anything but advisory text.
 */

const proposalJson = z
  .object({
    poolId: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
    swapParams: z
      .object({
        zeroForOne: z.boolean(),
        amountSpecified: z.string().regex(/^-?\d+$/),
        sqrtPriceLimitX96: z.string().regex(/^\d+$/),
      })
      .strict(),
    reasoning: z.string().min(1),
  })
  .strict();

export type LlmConfig = {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  /** injected in tests */
  fetchImpl?: typeof fetch;
  /** advisory system prompt, e.g. from `buildManagerPrompt` */
  systemPrompt?: string;
};

const DEFAULT_SYSTEM =
  "You are a portfolio manager. Respond with ONE JSON object and nothing else: " +
  '{"poolId":"0x…64hex","swapParams":{"zeroForOne":bool,"amountSpecified":"<int256>","sqrtPriceLimitX96":"<uint160>"},"reasoning":"<one sentence>"}';

export class LlmProposer implements Proposer {
  readonly name = "LlmProposer";
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;
  private readonly systemPrompt: string;

  constructor(private readonly cfg: LlmConfig | string) {
    const c: LlmConfig = typeof cfg === "string" ? { apiKey: cfg } : cfg;
    this.cfg = c;
    this.baseUrl = (c.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
    this.model = c.model ?? "gpt-4o-mini";
    this.fetchImpl = c.fetchImpl ?? fetch;
    this.systemPrompt = c.systemPrompt ?? DEFAULT_SYSTEM;
  }

  async propose(state: FundState): Promise<Proposal> {
    const apiKey = (this.cfg as LlmConfig).apiKey;
    if (!apiKey) throw new Error("LLM_API_KEY not set");

    const res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: this.systemPrompt },
          { role: "user", content: JSON.stringify({ fundState: state }) },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error("LLM returned no content");

    let raw: unknown;
    try {
      raw = JSON.parse(content);
    } catch {
      throw new Error(`LLM output is not JSON: ${content.slice(0, 200)}`);
    }
    const parsed = proposalJson.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`LLM output failed schema: ${parsed.error.message}`);
    }
    return parsed.data;
  }
}
