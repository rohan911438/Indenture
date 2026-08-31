"use client";

import { useState } from "react";
import type { SharesState } from "@/lib/data";

/**
 * /shares is about showing WHY a subscription is refused, not just that it is.
 *
 * Wallet connection is the only state on this app. Until the ATS contracts are
 * live we mock it (pick one of the demo wallets from shares-state.json); the
 * real path — wagmi useAccount/useConnect + IdentityRegistry.isVerified — slots
 * in where marked, gated on NEXT_PUBLIC_USE_MOCKS.
 */
const MOCKING = process.env.NEXT_PUBLIC_USE_MOCKS !== "false";

type Wallet = SharesState["wallets"][number];

export function SharesPanel({ state }: { state: SharesState }) {
  const [connected, setConnected] = useState<Wallet | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const frozen = state.shareClass.frozen;
  const blockedReason = !connected
    ? null
    : frozen
      ? `ComplianceRefused: share class is frozen — ${
          state.shareClass.frozenReason ?? "MandatePolicy.inBreach() is true"
        }`
      : !connected.identityVerified
        ? connected.refusalReason ??
          "ComplianceRefused: identity is not verified in the IdentityRegistry"
        : null;

  const canTransact = !!connected && !blockedReason;

  return (
    <div className="space-y-8">
      {/* --- connection --- */}
      <section>
        <div className="font-mono text-xs uppercase tracking-[0.25em] text-slate">
          Wallet
        </div>
        {!connected ? (
          <div className="mt-3">
            {MOCKING ? (
              <div className="space-y-2">
                <p className="font-sans text-sm text-slate">
                  Contracts are not live — choose a demo wallet:
                </p>
                <div className="flex flex-col gap-2">
                  {state.wallets.map((w) => (
                    <button
                      key={w.address}
                      onClick={() => {
                        setConnected(w);
                        setNote(null);
                      }}
                      className="text-left border border-hairline hover:border-slate px-3 py-2"
                    >
                      <span className="font-sans text-sm text-signal">
                        {w.label}
                      </span>
                      <span className="block font-mono text-xs text-slate">
                        {w.address} ·{" "}
                        {w.identityVerified ? "verified" : "not verified"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              // TODO(real): wagmi <ConnectButton /> / useConnect()
              <button className="border border-hairline px-3 py-2 font-sans text-sm">
                Connect wallet
              </button>
            )}
          </div>
        ) : (
          <div className="mt-3 flex items-baseline justify-between gap-4">
            <div className="font-mono text-xs text-slate break-all">
              {connected.address}
              <span
                className={
                  connected.identityVerified ? "text-brass" : "text-oxblood"
                }
              >
                {" "}
                · {connected.identityVerified ? "verified" : "not verified"}
              </span>
            </div>
            <button
              onClick={() => setConnected(null)}
              className="font-mono text-xs text-slate hover:text-signal"
            >
              disconnect
            </button>
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

        {!connected && (
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

        {note && (
          <p className="mt-4 font-mono text-xs text-brass">{note}</p>
        )}
      </section>
    </div>
  );
}
