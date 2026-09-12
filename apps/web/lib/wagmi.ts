"use client";

import { createConfig, http, injected } from "wagmi";
import { defineChain } from "viem";
import { hedera, hederaPreviewnet, hederaTestnet } from "viem/chains";
import { deployments } from "@/lib/deployments";

/**
 * The real wallet connection.
 *
 * The network is taken from contracts/deployments.json like everything else, so
 * the chain the wallet is asked to use and the chain the app reads from can
 * never drift apart. Hedera settles as EVM, so a wallet talks to it through the
 * JSON-RPC relay named in that file.
 *
 * No connector is configured by hand, and that is deliberate twice over.
 *
 * wagmi's EIP-6963 discovery is on by default, so every wallet extension the
 * browser actually has announces itself and appears in the connect list under
 * its own name and icon. That beats a hardcoded list: it cannot advertise a
 * wallet the reader does not have installed, and every current wallet —
 * MetaMask, Blade, HashPack, Rabby, Coinbase — implements the standard.
 *
 * One connector IS configured: a generic `injected()` fallback, for the case
 * where a wallet is present on `window.ethereum` but its EIP-6963 announcement
 * never arrives — which is exactly what a half-broken extension looks like. It
 * is imported from `wagmi` rather than `wagmi/connectors`, because that barrel
 * pulls in the Coinbase account SDK and through it an optional dependency that
 * does not resolve (`@x402/evm/upto/client`), breaking the build for connectors
 * this app never offers.
 *
 * WalletConnect is absent for a third reason: it needs a project id, and
 * shipping a button that fails for want of one is worse than not offering it.
 */
const CHAINS = {
  295: hedera,
  296: hederaTestnet,
  297: hederaPreviewnet,
} as const;

const chainId = deployments.network?.chainId ?? 296;
const rpcUrl = deployments.network?.rpcUrl ?? "https://testnet.hashio.io/api";

const known = CHAINS[chainId as keyof typeof CHAINS];

/** The deployment's chain, with the deployment's own relay as its RPC. */
export const fundChain = known
  ? defineChain({
      ...known,
      rpcUrls: { default: { http: [rpcUrl] } },
    })
  : defineChain({
      id: chainId,
      name: deployments.network?.name ?? "Hedera",
      nativeCurrency: { name: "HBAR", symbol: "HBAR", decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] } },
    });

export const wagmiConfig = createConfig({
  chains: [fundChain],
  connectors: [injected({ shimDisconnect: true })],
  transports: { [fundChain.id]: http(rpcUrl) },
  // The app is server-rendered; wagmi needs to know so it does not read storage
  // during SSR and then disagree with itself on hydration.
  ssr: true,
});

export const FUND_CHAIN_ID = fundChain.id;
export const FUND_CHAIN_NAME = fundChain.name;
