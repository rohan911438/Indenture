"use client";

import { useState } from "react";
import type { SharesState } from "@/lib/data";
import { useWallet } from "@/components/wallet/WalletProvider";

/**
 * /shares is about showing WHY a subscription is refused, not just that it is.
 * Connection state is the global WalletProvider (the header button). This panel
 * only reads it and drives the subscribe / redeem form.
 */
export function SharesPanel({ state }: { state: SharesState }) {
  const { connection, blockedReason, openModal, switchIdentity, identities } =
    useWallet();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const canTransact = !!connection && !blockedReason;

  return (
    <div className="space-y-8">
      {/* --- connection --- */}
      <section>
        <div className="font-mono text-xs uppercase tracking-[0.25em] text-slate">
          Wallet
        </div>

        {!connection ? (
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={openModal}
              className="border border-brass px-3 py-1.5 font-sans text-sm text-brass hover:bg-brass hover:text-ink transition-colors"
            >
              Connect wallet
            </button>
            <span className="font-sans text-sm text-slate">
              or use the button in the header
            </span>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="flex items-baseline justify-between gap-4">
              <div className="font-mono text-xs text-slate break-all">
                {connection.wallet.name} · {connection.identity.address}
                <span
                  className={
                    connection.identity.identityVerified
                      ? "text-brass"
                      : "text-oxblood"
                  }
                >
                  {" "}
                  ·{" "}
                  {connection.identity.identityVerified
                    ? "verified"
                    : "not verified"}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {identities.map((id) => {
                const active =
                  id.address === connection.identity.address;
                return (
                  <button
                    key={id.address}
                    onClick={() => {
                      switchIdentity(id.address);
                      setNote(null);
                    }}
                    className={
                      "border px-2.5 py-1 font-mono text-[11px] transition-colors " +
                      (active
                        ? "border-brass text-signal"
                        : "border-hairline text-slate hover:text-signal")
                    }
                  >
                    {id.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* --- subscribe / redeem --- */}
      <section>
        <div className="font-mono text-xs uppercase tracking-[0.25em] text-slate">
          Subscribe / redeem
        </div>

        <div className="mt-3 flex items-center gap-3">
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            disabled={!canTransact}
            className="w-40 bg-transparent border border-hairline px-3 py-2 font-mono text-sm text-signal placeholder:text-slate disabled:opacity-40"
          />
          <span className="font-mono text-xs text-slate">
            {state.shareClass.name}
          </span>
        </div>

        <div className="mt-3 flex gap-3">
          <button
            disabled={!canTransact}
            onClick={() =>
              setNote(
                `Would call SecurityToken.mint for ${amount || "0"} shares (contracts not live).`,
              )
            }
            className="border border-brass text-brass px-4 py-2 font-sans text-sm disabled:opacity-30 disabled:border-hairline disabled:text-slate"
          >
            Subscribe
          </button>
          <button
            disabled={!canTransact}
            onClick={() =>
              setNote(
                `Would call SecurityToken.redeem for ${amount || "0"} shares (contracts not live).`,
              )
            }
            className="border border-hairline text-slate px-4 py-2 font-sans text-sm hover:text-signal disabled:opacity-30"
          >
            Redeem
          </button>
        </div>

        {!connection && (
          <p className="mt-4 font-serif italic text-[15px] text-slate">
            Connect a wallet to see whether this share class will accept you.
          </p>
        )}

        {blockedReason && (
          <div className="mt-4 border-l-2 border-oxblood pl-4">
            <div className="font-mono text-[11px] uppercase tracking-wider text-oxblood">
              why this is refused
            </div>
            <p className="mt-2 font-serif text-[15px] leading-relaxed text-signal">
              {blockedReason}
            </p>
            <p className="mt-1 font-mono text-[11px] text-slate">
              The same check runs in CompliancePolicy.beforeSwap on-chain — the
              UI is only showing you the reason early.
            </p>
          </div>
        )}

        {connection && canTransact && (
          <div className="mt-4 border-l-2 border-brass pl-4">
            <div className="font-mono text-[11px] uppercase tracking-wider text-brass">
              cleared to subscribe
            </div>
            <p className="mt-2 font-mono text-[11px] text-slate">
              IdentityRegistry.isVerified is true and the class is open —
              CompliancePolicy would let this transfer through.
            </p>
          </div>
        )}

        {note && <p className="mt-4 font-mono text-xs text-brass">{note}</p>}
      </section>
    </div>
  );
}
