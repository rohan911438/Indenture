import { Suspense } from "react";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { Cursor } from "@/components/motion/Cursor";
import { PaperNav } from "@/components/paper/PaperNav";
import { PaperFooter } from "@/components/paper/PaperFooter";
import { SealGate } from "@/components/paper/SealGate";

/**
 * The four routes behind the seal.
 *
 * They share the landing's chrome, so crossing from the landing into the
 * instrument is not a change of product. The gate wraps the content rather
 * than the layout: the nav and the footer are never gated, because a locked
 * page you cannot navigate away from is a trap.
 */
export default function VaultLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="paper-root">
      <SmoothScroll />
      <Cursor />
      <PaperNav />

      <main id="main" style={{ paddingTop: 120 }}>
        {/* useSearchParams needs a boundary, and the gate reads ?demo=1. */}
        <Suspense fallback={<div style={{ minHeight: "70vh" }} />}>
          <SealGate>{children}</SealGate>
        </Suspense>
      </main>

      <PaperFooter />
    </div>
  );
}
