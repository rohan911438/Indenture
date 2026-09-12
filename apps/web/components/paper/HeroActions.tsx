"use client";

import Link from "next/link";
import { useWallet } from "@/components/wallet/WalletProvider";
import { Magnetic } from "@/components/motion/Magnetic";

/**
 * The hero's second action.
 *
 * Once a wallet is connected the bar already shows the address, so repeating it
 * here put the same truncated hex on screen twice and offered nothing to do
 * next. Connected, this becomes the next step instead: go and read the thing
 * the fund is bound by.
 */
export function HeroActions() {
  const { isConnected, openModal } = useWallet();

  if (isConnected) {
    return (
      <Magnetic>
        <Link className="btn btn--ghost" href="/mandate" data-cursor="OPEN">
          Read the mandate
        </Link>
      </Magnetic>
    );
  }

  return (
    <Magnetic>
      <button
        type="button"
        className="btn btn--ghost"
        data-cursor="CONNECT"
        onClick={openModal}
      >
        Connect wallet
      </button>
    </Magnetic>
  );
}
