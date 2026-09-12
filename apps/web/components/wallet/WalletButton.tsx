"use client";

import { FUND_CHAIN, useWallet } from "./WalletProvider";

function short(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

/** Square, not a dot — the same state mark the attack console uses. */
function StatusMark({ tone }: { tone: "ok" | "bad" | "unknown" }) {
  const bg =
    tone === "ok"
      ? "var(--brass)"
      : tone === "bad"
        ? "var(--oxblood-edge)"
        : "var(--slate-lit)";
  return (
    <span
      aria-hidden
      className="inline-block h-2 w-2 shrink-0"
      style={{ background: bg }}
    />
  );
}

export function WalletButton() {
  const {
    address,
    isConnected,
    connectorName,
    wrongChain,
    disconnect,
    switchToFundChain,
    registryLive,
    liveIdentity,
    openModal,
  } = useWallet();

  const tone = !registryLive
    ? "unknown"
    : liveIdentity?.identityVerified
      ? "ok"
      : "bad";

  return !isConnected ? (
    <button
      onClick={openModal}
      className="border border-brass px-3 py-1.5 font-sans text-data text-brass transition-colors duration-150 hover:bg-brass hover:text-ink"
    >
      Connect wallet
    </button>
  ) : wrongChain ? (
    <button
      onClick={switchToFundChain}
      className="flex items-center gap-2.5 border border-oxblood-edge px-3 py-1.5 font-sans text-data text-oxblood-lit transition-colors hover:bg-oxblood-edge hover:text-signal"
    >
      <StatusMark tone="bad" />
      Switch to {FUND_CHAIN.name}
    </button>
  ) : (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-2.5 border border-hairline px-3 py-1.5 font-sans text-data text-signal">
        <StatusMark tone={tone} />
        {connectorName ?? "Wallet"}
        <span className="data text-micro text-slate-lit">
          {address ? short(address) : ""}
        </span>
      </span>
      <button
        onClick={disconnect}
        className="font-sans text-data text-slate-lit transition-colors hover:text-signal"
      >
        Disconnect
      </button>
    </div>
  );
}
