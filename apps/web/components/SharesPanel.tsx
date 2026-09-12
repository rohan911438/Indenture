"use client";

import { useState } from "react";
import type { SharesState } from "@/lib/data";
import { FUND_CHAIN, useWallet } from "@/components/wallet/WalletProvider";
import { Rule } from "@/components/ui/Rule";
import { Tag } from "@/components/ui/Tag";

/**
 * /shares is about showing WHY a subscription is refused, not just that it is.
 *
 * There are two separate things on this panel and they must not blur: the real
 * wallet you connected, and a sample identity you can preview. The registry the
 * compliance contract consults is not deployed yet, so for a real address there
 * is genuinely nothing to ask — and the honest answer to "will this class accept
 * me" is that it cannot be decided, not a green tick. The preview exists so the
 * refusal reasons the contract WOULD give are still demonstrable.
 */
export function SharesPanel({ state }: { state: SharesState }) {
  const {
    address,
    isConnected,
    connectorName,
    wrongChain,
    switchToFundChain,
    openModal,
    identities,
    registryLive,
    liveIdentity,
    preview,
    setPreview,
    blockedReason,
    undecidable,
  } = useWallet();

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const subject = liveIdentity ?? preview;
  const canTransact = !!subject && !blockedReason && !wrongChain;

  return (
    <div className="grid grid-cols-1 gap-x-16 gap-y-14 lg:grid-cols-2">
      {/* --- connection ------------------------------------------------- */}
      <section>
        <h2 className="subheading text-signal">Who is asking</h2>

        {!isConnected ? (
          <div className="mt-6">
            <button
              onClick={openModal}
              className="border border-brass px-4 py-2 font-sans text-meta text-brass transition-colors duration-150 hover:bg-brass hover:text-ink"
            >
              Connect a wallet
            </button>
            <p className="prose-measure mt-4 font-sans text-data text-slate-lit">
              This opens your real wallet extension and asks it for{" "}
              {FUND_CHAIN.name}. Nothing is signed by connecting.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            <div>
              <p className="font-sans text-meta text-signal">{connectorName}</p>
              <p className="data mt-1 break-all text-data text-slate-lit">
                {address}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {wrongChain ? (
                  <>
                    <Tag tone="refused">wrong network</Tag>
                    <button
                      onClick={switchToFundChain}
                      className="link font-sans text-data text-brass"
                    >
                      Switch to {FUND_CHAIN.name}
                    </button>
                  </>
                ) : (
                  <Tag tone="approved">on {FUND_CHAIN.name}</Tag>
                )}
              </div>
            </div>

            {undecidable && (
              <div className="border-l-2 border-slate pl-5">
                <p className="font-sans text-data text-slate-lit">
                  This address cannot be checked
                </p>
                <p className="prose-measure mt-2 font-sans text-data text-slate-lit">
                  The IdentityRegistry this class consults is not deployed yet,
                  so there is no registry to ask about your wallet. Preview one
                  of the sample identities below to see the exact reasons the
                  compliance contract gives.
                </p>
              </div>
            )}
          </div>
        )}

        {/* --- the sample identities, clearly labelled as a preview ------ */}
        <div className="mt-8">
          <p className="font-sans text-micro text-slate">
            {registryLive
              ? "Or check the class against another registered identity"
              : "Preview a sample identity"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {identities.map((id) => {
              const active = preview?.address === id.address;
              return (
                <button
                  key={id.address}
                  onClick={() => {
                    setPreview(active ? null : id.address);
                    setNote(null);
                  }}
                  aria-pressed={active}
                  className={
                    "border px-3 py-1.5 font-sans text-data transition-colors duration-150 " +
                    (active
                      ? "border-brass text-signal"
                      : "border-hairline text-slate-lit hover:border-slate hover:text-signal")
                  }
                >
                  {id.label}
                </button>
              );
            })}
          </div>
          {preview && !registryLive && (
            <p className="prose-measure mt-3 font-sans text-micro text-oxblood-lit">
              Previewing sample data, not your wallet. These identities come from
              fixtures because no registry is deployed.
            </p>
          )}
        </div>
      </section>

      {/* --- subscribe / redeem ----------------------------------------- */}
      <section>
        <h2 className="subheading text-signal">Subscribe or redeem</h2>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <label className="sr-only" htmlFor="share-amount">
            Number of shares
          </label>
          <input
            id="share-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            disabled={!canTransact}
            className="data w-44 border border-hairline bg-transparent px-3 py-2 text-data text-signal placeholder:text-slate focus:border-brass disabled:opacity-40"
          />
          <span className="font-sans text-data text-slate-lit">
            {state.shareClass.name}
          </span>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            disabled={!canTransact}
            onClick={() =>
              setNote(
                `Would call SecurityToken.mint for ${amount || "0"} shares. The token is not deployed, so nothing was sent.`,
              )
            }
            className="border border-brass px-4 py-2 font-sans text-meta text-brass transition-colors duration-150 hover:bg-brass hover:text-ink disabled:border-hairline disabled:bg-transparent disabled:text-slate disabled:hover:bg-transparent"
          >
            Subscribe
          </button>
          <button
            disabled={!canTransact}
            onClick={() =>
              setNote(
                `Would call SecurityToken.redeem for ${amount || "0"} shares. The token is not deployed, so nothing was sent.`,
              )
            }
            className="border border-hairline px-4 py-2 font-sans text-meta text-slate-lit transition-colors duration-150 hover:text-signal disabled:text-slate"
          >
            Redeem
          </button>
        </div>

        {!subject && (
          <p className="prose-measure mt-7 font-serif text-[1.0625rem] italic leading-relaxed text-slate-lit">
            {isConnected
              ? "Pick an identity above to see whether this share class would accept it, and the exact reason if it would not."
              : "Connect a wallet, or preview a sample identity, to see whether this share class will accept you."}
          </p>
        )}

        {blockedReason && (
          <div className="mt-7 border-l-2 border-oxblood-edge pl-5">
            <Rule weight="refusal" className="mb-4 w-12" />
            <p className="font-sans text-data text-oxblood-lit">
              Why this is refused
            </p>
            <p className="prose-measure mt-3 font-serif text-[1.0625rem] leading-relaxed text-signal">
              {blockedReason}
            </p>
            <p className="prose-measure mt-3 font-sans text-data text-slate-lit">
              The same check runs in CompliancePolicy.beforeSwap on-chain. This
              page is only showing you the reason early.
            </p>
          </div>
        )}

        {subject && canTransact && (
          <div className="mt-7 border-l-2 border-brass pl-5">
            <p className="font-sans text-data text-brass">Cleared to subscribe</p>
            <p className="prose-measure mt-3 font-sans text-data text-slate-lit">
              IdentityRegistry.isVerified is true for{" "}
              {liveIdentity ? "this wallet" : subject.label} and the class is
              open, so CompliancePolicy would let this transfer through.
            </p>
          </div>
        )}

        {note && (
          <p className="prose-measure mt-6 font-sans text-data text-brass">
            {note}
          </p>
        )}
      </section>
    </div>
  );
}
