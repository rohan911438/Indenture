"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { SealStatic } from "@/components/seal/SealStatic";
import type { SealState } from "@/components/seal/rosette";

/**
 * Chooses which seal the reader gets, and in this order:
 *
 *   1. the SVG seal, always, in the server-rendered HTML
 *   2. the live engraving on top of it, but only once the client has confirmed
 *      WebGL2 is real and that reduced motion was not asked for
 *   3. back to the SVG if the canvas fails at any point
 *
 * The SVG is never removed from the document, so the accessible label and the
 * no-JavaScript rendering both survive whichever path runs.
 */
const Seal = dynamic(() => import("@/components/seal/Seal").then((m) => m.Seal), {
  ssr: false,
});

export function SealStage({
  state,
  title,
  className = "",
}: {
  state: SealState;
  title: string;
  className?: string;
}) {
  const [wantCanvas, setWantCanvas] = useState(false);
  const [canvasLive, setCanvasLive] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Probe for a real WebGL2 context before paying for the ogl chunk. The
    // shader is GLSL ES 3.00, so a WebGL1 fallback would not compile it.
    try {
      const probe = document.createElement("canvas").getContext("webgl2");
      if (!probe) return;
      probe.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      return;
    }
    setWantCanvas(true);
  }, []);

  return (
    <div className={`relative aspect-square ${className}`}>
      <SealStatic
        state={state}
        title={title}
        className={`absolute inset-0 h-full w-full transition-opacity duration-700 ${
          canvasLive ? "opacity-0" : "opacity-100"
        }`}
      />

      {wantCanvas && (
        <Seal
          state={state}
          onReady={() => setCanvasLive(true)}
          onFail={() => {
            setWantCanvas(false);
            setCanvasLive(false);
          }}
        />
      )}

      {/* the seal sits in a well, the way a blind-embossed one sits in stock */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          boxShadow:
            "inset 0 0 0 1px rgba(245,242,234,0.05), inset 0 2px 14px rgba(11,14,18,0.8), 0 14px 60px rgba(11,14,18,0.7)",
        }}
      />
    </div>
  );
}
