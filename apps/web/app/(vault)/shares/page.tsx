import { Suspense } from "react";
import { SharesDesk } from "@/components/paper/SharesDesk";
import { DemoChip } from "@/components/paper/SealGate";
import { Eyebrow, Rule } from "@/components/paper/Primitives";
import { Reveal } from "@/components/motion/Reveal";
import { getSharesState } from "@/lib/data";

export const revalidate = 5;

export const metadata = {
  title: "Shares — Indenture",
  description:
    "Buy, redeem, and find out for yourself whether this pool will trade with you.",
};

export default async function SharesPage() {
  const src = await getSharesState();

  return (
    <>
      <section className="shell page-head">
        <div className="page-head__chips">
          <Eyebrow>Shares</Eyebrow>
          <Suspense fallback={null}>
            <DemoChip seeded={!src.live} />
          </Suspense>
        </div>

        <Reveal as="h1" className="t-display-l section__head" start="top 95%">
          A pool that checks who you are.
        </Reveal>

        <p className="t-prose" style={{ marginTop: 48, color: "var(--ink-2)" }}>
          An ERC-3643 security token cannot trade on a normal AMM, because a
          permissionless pool has no idea who the counterparty is and the token
          is not allowed to move to someone it has not cleared. The hook asks
          the identity registry inside <code className="t-data">beforeSwap</code>,
          which is the secondary market Asset Tokenization Studio does not ship.
        </p>

        {!src.live && src.note && (
          <p className="t-data-sm" style={{ marginTop: 24, color: "var(--ink-3)" }}>
            SOURCE · SEEDED — {src.note.toUpperCase()}
          </p>
        )}
      </section>

      <Rule />

      <section className="shell" style={{ paddingBlock: "clamp(48px, 5vw, 80px)" }}>
        <SharesDesk
          shareClass={src.data.shareClass}
          identities={src.data.wallets}
          registryLive={src.live}
        />
      </section>
    </>
  );
}
