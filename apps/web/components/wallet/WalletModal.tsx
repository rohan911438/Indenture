"use client";

import { useEffect } from "react";
import { FUND_CHAIN, useWallet } from "./WalletProvider";
import { Tag } from "@/components/ui/Tag";

/**
 * The wallet picker.
 *
 * It lives with the provider, not with the button, because two different
 * chromes open it — the instrument header's WalletButton and the paper nav's
 * ConnectAction — and the one that owns the markup must be mounted on every
 * route that can set `modalOpen`. It was mounted on only one of them, so the
 * paper pages flipped the flag and nothing appeared.
 */
export function WalletModal() {
  const {
    connectors,
    connect,
    connecting,
    connectError,
    stalled,
    modalOpen,
    closeModal,
  } = useWallet();

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, closeModal]);

  // Wallets the browser announced over EIP-6963, and separately the generic
  // injected fallback. The fallback is always offered, not hidden behind
  // "nothing was discovered": a wallet whose announcement works but whose
  // provider is broken would otherwise leave no way through at all.
  const discovered = connectors.filter((c) => c.id !== "injected");
  const fallback = connectors.filter((c) => c.id === "injected");

  if (!modalOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Connect a wallet"
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]"
    >
      <button
        aria-label="Close"
        onClick={closeModal}
        className="absolute inset-0 cursor-default bg-ink-deep/85"
      />
      <div className="relative w-full max-w-md border border-hairline bg-ink p-6">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="subheading text-signal">Connect a wallet</h2>
          <button
            onClick={closeModal}
            className="font-sans text-data text-slate-lit transition-colors hover:text-signal"
          >
            Close
          </button>
        </div>

        {discovered.length + fallback.length > 0 ? (
          <div className="mt-6 flex flex-col gap-2">
            {[...discovered, ...fallback].map((c) => (
              <button
                key={c.uid}
                disabled={connecting && !stalled}
                onClick={() => connect(c)}
                className="flex items-center gap-3 border border-hairline px-3 py-3 text-left transition-colors hover:border-slate disabled:opacity-40"
              >
                {c.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.icon}
                    alt=""
                    aria-hidden
                    className="h-8 w-8 shrink-0"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="flex h-8 w-8 shrink-0 items-center justify-center border border-brass font-serif text-meta text-brass"
                  >
                    {c.id === "injected" ? "B" : c.name[0]}
                  </span>
                )}
                <span>
                  <span className="block font-sans text-meta text-signal">
                    {/* wagmi names the generic connector after whatever sits
                        on window.ethereum, which duplicates a discovered
                        wallet's name and reads as the same entry twice. */}
                    {c.id === "injected" ? "Browser wallet" : c.name}
                  </span>
                  <span className="block font-sans text-data text-slate-lit">
                    {c.id === "injected"
                      ? "Whatever wallet this browser exposes — try this if the one above will not open"
                      : `Opens the extension, on ${FUND_CHAIN.name}`}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-6 font-sans text-meta text-slate-lit">
            No wallet extension announced itself to this page. Install MetaMask,
            Blade or HashPack and reload, and it will appear here.
          </p>
        )}

        {stalled && !connectError && (
          <div className="mt-5 border-l-2 border-oxblood-edge pl-4">
            <p className="font-sans text-data text-oxblood-lit">
              The wallet has not answered
            </p>
            <p className="prose-measure mt-3 font-sans text-data text-slate-lit">
              The request was accepted by the extension but nothing came back,
              which means its background worker has stopped. Look for a wallet
              popup hiding behind this window first. If there is none, open the
              extension from the toolbar to wake it, or reload it from your
              browser&rsquo;s extensions page, then try again.
            </p>
          </div>
        )}

        {connectError && (
          <div className="mt-5 border-l-2 border-oxblood-edge pl-4">
            <p className="font-sans text-data text-oxblood-lit">
              {connectError}
            </p>
            {/* "Failed to connect to …" is the extension never answering,
                not a rejected request. It is nearly always an asleep or
                locked extension, or a browser with a built-in wallet that
                has displaced it — so say what to do about it. */}
            {/failed to connect|not (been )?(found|detected)|no provider/i.test(
              connectError,
            ) && (
              <p className="prose-measure mt-3 font-sans text-data text-slate-lit">
                The extension did not answer. Open it once to wake it and check
                it is unlocked, then try again. If your browser has its own
                built-in wallet, such as Brave, set that browser to prefer
                extensions for Ethereum — otherwise it displaces the extension
                you picked. Any other wallet listed above will work in the
                meantime.
              </p>
            )}
          </div>
        )}

        <div className="mt-6 flex items-start gap-3">
          <Tag>{FUND_CHAIN.name}</Tag>
          <p className="font-sans text-data leading-relaxed text-slate-lit">
            This opens your real wallet and asks it for {FUND_CHAIN.name}, chain{" "}
            {FUND_CHAIN.id}. Hedera settles as EVM, so any wallet that speaks
            the JSON-RPC relay works. Nothing is signed by connecting.
          </p>
        </div>
      </div>
    </div>
  );
}
