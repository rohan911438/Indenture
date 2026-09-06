/**
 * The last step of a tick: submit the Validator-approved trade on chain.
 *
 * This is the only place the Manager holds a key, and it is deliberately the
 * dumbest code in the repo. It does not decide anything. It forwards a receipt
 * it cannot forge to a vault that will not act without one, into a hook that
 * re-checks the covenants regardless. MANAGER_KEY's blast radius is "low by
 * design" precisely because this function is incapable of doing anything else.
 */
import {
  createWalletClient,
  createPublicClient,
  http,
  parseAbi,
  getAddress,
  type Hex,
  type Transport,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

export const vaultAbi = parseAbi([
  "function trade((address,address,uint24,int24,address) key, (bool,int256,uint160) params, bytes receiptBlob)",
]);

export type PoolConfig = {
  currency0: Hex;
  currency1: Hex;
  fee: number;
  tickSpacing: number;
  hooks: Hex;
};

export type TradeArgs = {
  vault: Hex;
  pool: PoolConfig;
  swapParams: { zeroForOne: boolean; amountSpecified: string; sqrtPriceLimitX96: string };
  /** abi.encode(Receipt, signature) — forwarded verbatim as v4 hookData */
  receiptBlob: Hex;
  privateKey: Hex;
  rpcUrl: string;
  chainId: number;
  /** injected by tests */
  transport?: Transport;
};

/**
 * The exact tuple `IndentureVault.trade` expects. Kept as a named function so
 * the field ORDER is stated once — PoolKey is a positional tuple on the wire,
 * and silently transposing currency0/currency1 would produce a valid-looking
 * call against a pool that does not exist.
 */
export function poolKeyTuple(p: PoolConfig): readonly [Hex, Hex, number, number, Hex] {
  return [
    getAddress(p.currency0),
    getAddress(p.currency1),
    p.fee,
    p.tickSpacing,
    getAddress(p.hooks),
  ] as const;
}

export function swapParamsTuple(s: TradeArgs["swapParams"]): readonly [boolean, bigint, bigint] {
  return [s.zeroForOne, BigInt(s.amountSpecified), BigInt(s.sqrtPriceLimitX96)] as const;
}

export async function submitTrade(args: TradeArgs): Promise<Hex> {
  const account = privateKeyToAccount(args.privateKey);
  const chain = {
    id: args.chainId,
    name: `chain-${args.chainId}`,
    nativeCurrency: { name: "HBAR", symbol: "HBAR", decimals: 18 },
    rpcUrls: { default: { http: [args.rpcUrl] } },
  } as const;

  const transport = args.transport ?? http(args.rpcUrl);
  const wallet = createWalletClient({ account, chain, transport });
  const pub = createPublicClient({ chain, transport });

  const { request } = await pub.simulateContract({
    account,
    address: args.vault,
    abi: vaultAbi,
    functionName: "trade",
    args: [poolKeyTuple(args.pool), swapParamsTuple(args.swapParams), args.receiptBlob],
  });

  return wallet.writeContract(request);
}
