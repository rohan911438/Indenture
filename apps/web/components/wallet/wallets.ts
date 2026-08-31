/**
 * Wallet options shown in the connect modal. Solana-first wallets (all of
 * these also speak other chains). This is a MOCK connector — selecting one
 * sets local connection state; no extension is invoked. When the ATS
 * contracts are live, swap this list + WalletProvider.connect() for the real
 * adapter (e.g. @solana/wallet-adapter-react, or wagmi for the EVM side of
 * Hedera) — nothing else changes.
 */
export type WalletOption = {
  id: string;
  name: string;
  note: string;
  /** brand accent for the status dot / monogram */
  accent: string;
};

export const WALLET_OPTIONS: WalletOption[] = [
  { id: "phantom", name: "Phantom", note: "Solana · multichain", accent: "#AB9FF2" },
  { id: "solflare", name: "Solflare", note: "Solana", accent: "#FFC947" },
  { id: "backpack", name: "Backpack", note: "Solana", accent: "#E33E3F" },
  {
    id: "okx",
    name: "OKX Wallet",
    note: "Solana · EVM · 100+ chains",
    accent: "#A6863C",
  },
];

export function walletById(id: string): WalletOption {
  return WALLET_OPTIONS.find((w) => w.id === id) ?? WALLET_OPTIONS[0]!;
}
