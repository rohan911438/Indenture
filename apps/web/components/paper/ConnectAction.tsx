"use client";

import { useWallet } from "@/components/wallet/WalletProvider";
import { Magnetic } from "@/components/motion/Magnetic";

function short(a: string) {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

/**
 * Connect, in the paper system's clothes.
 *
 * The wallet picker it opens is the one the rest of the site already uses —
 * a second connection path would be a second set of bugs, and this one has
 * EIP-6963 discovery and the wrong-chain recovery already working.
 */
export function ConnectAction({ magnetic = false }: { magnetic?: boolean }) {
  const { address, isConnected, openModal, disconnect } = useWallet();

  const button = (
    <button
      type="button"
      className="btn btn--ghost"
      data-cursor={isConnected ? "OPEN" : "CONNECT"}
      onClick={() => (isConnected ? disconnect() : openModal())}
    >
      {isConnected && address ? short(address) : "Connect wallet"}
    </button>
  );

  return magnetic ? <Magnetic>{button}</Magnetic> : button;
}
