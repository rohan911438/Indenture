"use client";

import { useEffect, useState } from "react";
import { useWallet } from "./WalletProvider";
import { WALLET_OPTIONS } from "./wallets";

function short(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

export function WalletButton() {
  const {
    connection,
    identities,
    modalOpen,
    openModal,
    closeModal,
    connect,
    switchIdentity,
    disconnect,
  } = useWallet();
  const [popover, setPopover] = useState(false);

  // Escape closes whichever surface is open
  useEffect(() => {
    if (!modalOpen && !popover) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeModal();
        setPopover(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, popover, closeModal]);

  return (
    <>
      {/* --- trigger --- */}
      {!connection ? (
        <button
          onClick={openModal}
          className="border border-brass px-3 py-1.5 font-sans text-sm text-brass hover:bg-brass hover:text-ink transition-colors"
        >
          Connect wallet
        </button>
      ) : (
        <div className="relative">
          <button
            onClick={() => setPopover((v) => !v)}
            aria-expanded={popover}
            className="flex items-center gap-2 border border-hairline px-3 py-1.5 font-mono text-xs text-signal hover:border-slate"
          >
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-full"
              style={{
                background: connection.identity.identityVerified
                  ? "var(--brass)"
                  : "var(--oxblood)",
              }}
            />
            {connection.wallet.name} · {short(connection.identity.address)}
          </button>

          {popover && (
            <>
              <button
                aria-label="close"
                onClick={() => setPopover(false)}
                className="fixed inset-0 z-40 cursor-default"
              />
              <div className="absolute right-0 z-50 mt-2 w-72 border border-hairline bg-ink p-3">
                <div className="font-mono text-[11px] uppercase tracking-wider text-slate">
                  Demo identity
                </div>
                <div className="mt-2 flex flex-col gap-1">
                  {identities.map((id) => {
                    const active = id.address === connection.identity.address;
                    return (
                      <button
                        key={id.address}
                        onClick={() => {
                          switchIdentity(id.address);
                          setPopover(false);
                        }}
                        className={
                          "text-left px-2 py-1.5 border transition-colors " +
                          (active
                            ? "border-brass"
                            : "border-transparent hover:border-hairline")
                        }
                      >
                        <span className="font-sans text-sm text-signal">
                          {id.label}
                        </span>
                        <span
                          className={
                            "block font-mono text-[11px] " +
                            (id.identityVerified
                              ? "text-brass"
                              : "text-oxblood")
                          }
                        >
                          {short(id.address)} ·{" "}
                          {id.identityVerified ? "verified" : "not verified"}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => {
                    disconnect();
                    setPopover(false);
                  }}
                  className="mt-3 w-full border border-hairline px-2 py-1.5 font-mono text-xs text-slate hover:text-signal"
                >
                  disconnect
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* --- connect modal --- */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Connect a wallet"
          className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]"
        >
          <button
            aria-label="close"
            onClick={closeModal}
            className="absolute inset-0 cursor-default bg-ink/80"
          />
          <div className="relative w-full max-w-sm border border-hairline bg-ink p-6">
            <div className="flex items-baseline justify-between">
              <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-slate">
                Connect a wallet
              </h2>
              <button
                onClick={closeModal}
                className="font-mono text-xs text-slate hover:text-signal"
              >
                esc
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              {WALLET_OPTIONS.map((w) => (
                <button
                  key={w.id}
                  onClick={() => connect(w.id)}
                  className="flex items-center gap-3 border border-hairline px-3 py-2.5 text-left hover:border-slate transition-colors"
                >
                  <span
                    aria-hidden
                    className="flex h-7 w-7 items-center justify-center rounded-full font-mono text-xs text-ink"
                    style={{ background: w.accent }}
                  >
                    {w.name[0]}
                  </span>
                  <span>
                    <span className="block font-sans text-sm text-signal">
                      {w.name}
                    </span>
                    <span className="block font-mono text-[11px] text-slate">
                      {w.note}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            <p className="mt-4 font-mono text-[11px] leading-relaxed text-slate">
              Demo connector — no extension is opened. Hedera settles as EVM;
              when the ATS contracts are live this list swaps for the real
              adapter and nothing else changes.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
