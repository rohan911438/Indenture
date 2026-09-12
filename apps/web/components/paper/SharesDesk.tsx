"use client";

import { useRef, useState } from "react";
import { gsap, useGSAP, prefersReducedMotion } from "@/components/motion/gsapPaper";
import { stampInto } from "@/components/motion/stamp";
import { Mark } from "@/components/brand/Mark";
import { Chip, Panel } from "./Primitives";
import { Hash } from "./Hash";
import { useWallet } from "@/components/wallet/WalletProvider";
import { D } from "@/lib/motion";

export type ShareClass = {
  name: string;
  token: string;
  totalSupply: string;
  holders: number | null;
  navPerShare: string;
  frozen: boolean;
  frozenReason: string | null;
};

export type Identity = {
  address: string;
  label: string;
  identityVerified: boolean;
  refusalReason?: string;
};

const IDENTITY_REVERT = "IdentityNotVerified";

/**
 * The desk.
 *
 * The important control on this page is "Try it anyway". A paragraph saying the
 * pool will refuse an unverified buyer is a claim; a button that makes it
 * happen in front of you is the product. So the refusal is never hidden behind
 * a disabled button — you are told what will happen and then invited to do it.
 *
 * What it cannot do is pretend. No ERC-3643 share class is deployed yet, so
 * this runs the refusal the hook would return and says so in the same breath.
 * A simulated verdict wearing a real one's clothes is the single dishonesty
 * this project cannot afford.
 */
export function SharesDesk({
  shareClass,
  identities,
  registryLive,
}: {
  shareClass: ShareClass;
  identities: Identity[];
  registryLive: boolean;
}) {
  const { address, isConnected, openModal } = useWallet();
  const [amount, setAmount] = useState("1000");
  const [refused, setRefused] = useState<string | null>(null);

  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const stamp = useRef<HTMLDivElement>(null);

  const { contextSafe } = useGSAP({ scope: root });

  /**
   * The connected wallet's standing. Unknown is its own answer: a registry that
   * cannot be reached has not said "no", and showing that as a refusal would be
   * inventing a verdict.
   */
  const known = identities.find(
    (i) => address && i.address.toLowerCase() === address.toLowerCase(),
  );
  const verified = known?.identityVerified ?? false;
  const unknown = isConnected && !known;

  const reason = shareClass.frozen
    ? (shareClass.frozenReason ?? 'CovenantBreach("share class frozen")')
    : (known?.refusalReason ??
      `${IDENTITY_REVERT}: ${address ?? "this wallet"} is not in the IdentityRegistry`);

  const tryAnyway = contextSafe(() => {
    setRefused(reason);
    if (prefersReducedMotion()) return;
    const tl = gsap.timeline();
    stampInto(tl, { mark: stamp.current, panel: panel.current });
    tl.from(
      root.current?.querySelector("[data-revert]") ?? null,
      { opacity: 0, y: 8, duration: D.sm },
      "<",
    );
  });

  return (
    <div ref={root} className="grid gap-6 lg:grid-cols-12">
      {/* --- the share class -------------------------------------------- */}
      <Panel
        className="lg:col-span-5"
        label="SHARE CLASS"
        chip={
          shareClass.frozen ? (
            <Chip status="refuse">FROZEN</Chip>
          ) : (
            <Chip status="permit">OPEN</Chip>
          )
        }
      >
        <div style={{ padding: 32 }}>
          <p className="t-data-sm" style={{ color: "var(--ink-3)" }}>
            NAV PER SHARE
          </p>
          <p className="t-numeral" style={{ marginTop: 12 }}>
            ${Number(shareClass.navPerShare).toFixed(4)}
          </p>

          <dl className="mt-10 flex flex-col gap-5">
            <Row label="CLASS" value={shareClass.name} />
            <Row
              label="SUPPLY"
              value={(Number(shareClass.totalSupply) / 1e6).toLocaleString("en-US")}
            />
            <Row
              label="HOLDERS"
              value={shareClass.holders == null ? "—" : String(shareClass.holders)}
            />
            <div className="flex items-baseline justify-between gap-4">
              <dt className="t-data-sm" style={{ color: "var(--ink-3)" }}>
                TOKEN
              </dt>
              <dd style={{ margin: 0 }}>
                {/* No ERC-3643 class is issued yet. Printing a plausible
                    address here would send someone to an explorer to find
                    nothing, which is worse than saying so. */}
                {shareClass.token ? (
                  <Hash value={shareClass.token} />
                ) : (
                  <span className="t-data" style={{ color: "var(--ink-3)" }}>
                    NOT ISSUED YET
                  </span>
                )}
              </dd>
            </div>
          </dl>
        </div>
      </Panel>

      {/* --- buy / redeem ------------------------------------------------ */}
      <div ref={panel} className="lg:col-span-7" style={{ position: "relative" }}>
        <Panel
          label="BUY / REDEEM"
          chip={
            !isConnected ? (
              <Chip status="neutral">NO WALLET</Chip>
            ) : unknown ? (
              <Chip status="watch">UNKNOWN TO THE REGISTRY</Chip>
            ) : verified ? (
              <Chip status="permit">VERIFIED</Chip>
            ) : (
              <Chip status="refuse">NOT VERIFIED</Chip>
            )
          }
        >
          <div style={{ padding: 32 }}>
            <div className="flex flex-wrap items-end gap-4">
              <label style={{ flex: "1 1 200px", minWidth: 0 }}>
                <span className="t-data-sm" style={{ color: "var(--ink-3)" }}>
                  AMOUNT (QUOTE)
                </span>
                <input
                  className="term__input"
                  style={{ width: "100%", marginTop: 10 }}
                  value={amount}
                  inputMode="decimal"
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                />
              </label>
              <button type="button" className="btn btn--primary" onClick={tryAnyway}>
                Buy
              </button>
              <button type="button" className="btn btn--ghost" onClick={tryAnyway}>
                Redeem
              </button>
            </div>

            <div style={{ marginTop: 32, borderTop: "1px solid var(--border)", paddingTop: 24 }}>
              {!isConnected ? (
                <>
                  <p className="t-small" style={{ color: "var(--ink-2)" }}>
                    No wallet is connected, so the identity registry has nobody
                    to answer about. Connect one, or trigger the refusal an
                    unverified buyer would get.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <button type="button" className="btn btn--ghost" onClick={openModal}>
                      Connect wallet
                    </button>
                    <button type="button" className="btn btn--ghost" onClick={tryAnyway}>
                      Try it anyway
                    </button>
                  </div>
                </>
              ) : verified && !shareClass.frozen ? (
                <p className="t-small" style={{ color: "var(--ink-2)" }}>
                  This wallet is in the registry, so a swap against this pool
                  would clear <code className="t-data">canTransfer</code> and
                  reach the covenant checks.
                </p>
              ) : (
                <>
                  <p className="t-small" style={{ color: "var(--ink-2)" }}>
                    A swap from this wallet will revert with{" "}
                    <span className="t-data" style={{ color: "var(--refuse)" }}>
                      {shareClass.frozen ? "CovenantBreach" : IDENTITY_REVERT}
                    </span>
                    . You do not have to take that on trust.
                  </p>
                  <button
                    type="button"
                    className="btn btn--ghost mt-6"
                    data-cursor="REFUSE"
                    onClick={tryAnyway}
                  >
                    Try it anyway
                  </button>
                </>
              )}

              {refused && (
                <div
                  data-revert
                  style={{
                    marginTop: 24,
                    padding: 20,
                    borderRadius: 14,
                    background: "var(--refuse-bg)",
                  }}
                >
                  <p className="t-data" style={{ color: "var(--refuse)", overflowWrap: "anywhere" }}>
                    {refused}
                  </p>
                  <p className="t-data-sm" style={{ marginTop: 12, color: "var(--ink-2)" }}>
                    {registryLive
                      ? "READ FROM THE DEPLOYED IDENTITY REGISTRY."
                      : "REHEARSED — NO ERC-3643 SHARE CLASS IS DEPLOYED YET, SO THIS IS THE REVERT THE HOOK RETURNS, NOT A TRANSACTION THAT WAS SENT."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </Panel>

        <div
          ref={stamp}
          className="stamp"
          style={{ right: 24, top: 64 }}
          aria-hidden="true"
        >
          <Mark state="refused" size={104} />
        </div>
      </div>

      {/* --- who the registry knows -------------------------------------- */}
      <Panel className="lg:col-span-12" label="IDENTITY REGISTRY">
        <div className="dt__scroll" style={{ padding: "0 32px 24px" }}>
          <table className="dt">
            <thead>
              <tr>
                <th>WALLET</th>
                <th>LABEL</th>
                <th>canTransfer</th>
                <th>IF REFUSED</th>
              </tr>
            </thead>
            <tbody>
              {identities.map((i) => (
                <tr key={i.address}>
                  <td>
                    <Hash value={i.address} />
                  </td>
                  <td>{i.label}</td>
                  <td>
                    <span
                      className="dot"
                      style={{
                        background: i.identityVerified
                          ? "var(--permit)"
                          : "var(--refuse)",
                      }}
                    />
                    {i.identityVerified ? "true" : "false"}
                  </td>
                  <td style={{ whiteSpace: "normal", color: "var(--refuse)" }}>
                    {i.refusalReason ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="t-data-sm" style={{ color: "var(--ink-3)" }}>
        {label}
      </dt>
      <dd className="t-data" style={{ margin: 0, color: "var(--ink-2)" }}>
        {value}
      </dd>
    </div>
  );
}
