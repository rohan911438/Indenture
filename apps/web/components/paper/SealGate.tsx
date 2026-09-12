"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { gsap, useGSAP, prefersReducedMotion } from "@/components/motion/gsapPaper";
import { Logo } from "@/components/brand/Logo";
import { DEMO_PARAM, readDemoCookie, writeDemoCookie } from "@/lib/demo";
import { useWallet } from "@/components/wallet/WalletProvider";
import { D, E } from "@/lib/motion";

const COPY: Record<string, { name: string; line: string }> = {
  "/mandate": {
    name: "The mandate",
    line: "The covenants the fund is bound by, and how close it currently sits to each one.",
  },
  "/journal": {
    name: "The journal",
    line: "Every decision the fund has made, written to Hedera consensus before it was anyone's word.",
  },
  "/blocked": {
    name: "The wall",
    line: "Every attempt the hook refused, and the exact prompt the manager was looking at when it tried.",
  },
  "/shares": {
    name: "Shares",
    line: "Buy, redeem, and find out for yourself whether this pool will trade with you.",
  },
};

/**
 * The gate.
 *
 * Three rules it exists to keep. It never redirects — the route you asked for
 * is the route you get. It never blanks — the page renders underneath, blurred,
 * so you can see the shape of what you are being offered. And it never asks for
 * a signature to read something that is already public on a testnet.
 *
 * "View demo" is the important button, not the fallback one. Most people
 * looking at this will not have a Hedera wallet, and a submission that is
 * unreachable without one is a submission nobody sees.
 */
export function SealGate({ children }: { children: React.ReactNode }) {
  const { isConnected } = useWallet();
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();

  const [demo, setDemo] = useState(false);
  const [mounted, setMounted] = useState(false);

  const overlay = useRef<HTMLDivElement>(null);
  const behind = useRef<HTMLDivElement>(null);

  // The cookie and the query string both count. Read after mount so the server
  // HTML is the same for everyone and nothing hydrates differently.
  useEffect(() => {
    setDemo(params.get(DEMO_PARAM) === "1" || readDemoCookie());
    setMounted(true);
  }, [params]);

  const unlocked = mounted && (isConnected || demo);
  const copy = COPY[pathname] ?? {
    name: "The instrument",
    line: "Connect a wallet, or open the demo.",
  };

  useGSAP(
    () => {
      if (!unlocked) return;
      const el = overlay.current;
      const under = behind.current;
      if (!under) return;

      if (prefersReducedMotion()) {
        if (el) el.style.display = "none";
        return;
      }

      const tl = gsap.timeline();

      // The halves come apart while the overlay opens from its own centre: the
      // instrument is being opened, not a modal being dismissed.
      if (el) {
        const mark = el.querySelector<HTMLElement>(".mark");
        if (mark) {
          tl.to(
            mark.querySelector(".mark__half--a"),
            { y: -14, rotate: -3, duration: D.lg, ease: E.big },
            0,
          ).to(
            mark.querySelector(".mark__half--b"),
            { y: 14, rotate: 3, duration: D.lg, ease: E.big },
            0,
          );
        }
        tl.to(
          el,
          { clipPath: "inset(50% 0 50% 0)", opacity: 0, duration: D.lg, ease: E.big },
          0,
        ).set(el, { display: "none" });
      }

      tl.fromTo(
        under,
        { opacity: 0.5, filter: "blur(7px)" },
        { opacity: 1, filter: "blur(0px)", duration: D.md, ease: E.out },
        el ? "-=0.6" : 0,
      );

      return () => tl.kill();
    },
    { dependencies: [unlocked], scope: overlay },
  );

  return (
    <div className="gate">
      <div
        ref={behind}
        className="gate__behind"
        data-locked={!unlocked}
        aria-hidden={!unlocked}
        inert={!unlocked ? true : undefined}
      >
        {children}
      </div>

      {!unlocked && (
        <div ref={overlay} className="gate__overlay" style={{ clipPath: "inset(0 0 0 0)" }}>
          <div className="gate__panel" role="dialog" aria-label={copy.name}>
            <div className="flex justify-center">
              <Logo variant="stacked" size={64} state="sealed" />
            </div>

            <h2 className="t-title" style={{ marginTop: 32 }}>
              {copy.name}
            </h2>
            <p
              className="t-small"
              style={{ marginTop: 12, color: "var(--ink-2)" }}
            >
              {copy.line}
            </p>

            <div className="gate__actions">
              <ConnectButton />
              <button
                type="button"
                className="btn btn--ghost"
                data-cursor="OPEN"
                onClick={() => {
                  writeDemoCookie();
                  setDemo(true);
                  // Keep the choice in the URL too, so the link is shareable.
                  router.replace(`${pathname}?${DEMO_PARAM}=1`, { scroll: false });
                }}
              >
                View demo
              </button>
            </div>

            <p
              className="t-data-sm"
              style={{ marginTop: 24, color: "var(--ink-3)" }}
            >
              NOTHING HERE IS PRIVATE. THE GATE IS A COURTESY, NOT A PERMISSION.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ConnectButton() {
  const { openModal } = useWallet();
  return (
    <button
      type="button"
      className="btn btn--primary"
      data-cursor="CONNECT"
      onClick={openModal}
    >
      Connect wallet
    </button>
  );
}

/**
 * Shown in a gated page's header whenever the gate was opened without a wallet.
 *
 * The wording is not decoration. Some figures on these pages are read live even
 * in demo mode — the mandate hash and its amendment chain come off a real HCS
 * topic — so a blanket "DEMO DATA" would be a claim that everything below is
 * invented, which is its own kind of lie. The page passes in whether its own
 * primary source was seeded and the chip says only what is true.
 */
export function DemoChip({ seeded = true }: { seeded?: boolean }) {
  const params = useSearchParams();
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    setDemo(params.get(DEMO_PARAM) === "1" || readDemoCookie());
  }, [params]);
  if (!demo) return null;
  return <span className="demo-chip">{seeded ? "DEMO DATA" : "DEMO MODE"}</span>;
}
