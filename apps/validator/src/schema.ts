import { z } from "zod";

/**
 * THE BOUNDARY. The Validator's input is EXACTLY {poolId, swapParams}.
 * `.strict()` rejects any unknown key. No free text, no mandate, no prices,
 * no "context" from the Manager ever crosses this line - the Validator fetches
 * all of that itself, from source.
 */
export const validateRequestSchema = z
  .object({
    poolId: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
    swapParams: z
      .object({
        zeroForOne: z.boolean(),
        amountSpecified: z.string().regex(/^-?\d+$/), // int256 as decimal string
        sqrtPriceLimitX96: z.string().regex(/^\d+$/), // uint160 as decimal string
      })
      .strict(),
  })
  .strict();

export type ValidateRequest = z.infer<typeof validateRequestSchema>;
