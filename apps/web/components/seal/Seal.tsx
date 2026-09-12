"use client";

import { useEffect, useRef } from "react";
import { Mesh, Program, Renderer, Triangle } from "ogl";
import {
  FRAG,
  rgb,
  SEAL_PALETTE,
  VERT,
  type SealState,
} from "@/components/seal/rosette";

/**
 * The seal, engraved live. One fullscreen triangle and one fragment shader —
 * which is why this is ogl (10KB) and not three.js: there is no scene, no
 * camera and no geometry to manage.
 *
 * Mounted only by SealStage, and only once it has confirmed WebGL2 and that
 * the reader has not asked for reduced motion. If anything here fails it calls
 * onFail() and the SVG seal stays on screen — the page is never waiting on a
 * canvas.
 */
export function Seal({
  state,
  onReady,
  onFail,
}: {
  state: SealState;
  onReady: () => void;
  onFail: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  // read inside the effect without making it a dependency — the uniform is
  // updated in place, the renderer is never rebuilt for a value change
  const latest = useRef(state);
  latest.current = state;

  useEffect(() => {
    const el = host.current;
    if (!el) return;

    let renderer: Renderer | undefined;
    let frame = 0;
    let observer: ResizeObserver | undefined;
    let canvas: HTMLCanvasElement | undefined;
    let announced = false;

    try {
      renderer = new Renderer({
        alpha: true,
        antialias: false, // the relief lighting antialiases itself
        depth: false,
        dpr: Math.min(window.devicePixelRatio || 1, 2),
        powerPreference: "low-power",
      });
      // GLSL ES 3.00 — a WebGL1 fallback context cannot compile this shader.
      if (!renderer.isWebgl2) throw new Error("WebGL2 unavailable");

      const gl = renderer.gl;
      canvas = gl.canvas as HTMLCanvasElement;
      gl.clearColor(0, 0, 0, 0);

      const s = latest.current;
      const program = new Program(gl, {
        vertex: VERT,
        fragment: FRAG,
        transparent: true,
        uniforms: {
          uResolution: { value: [1, 1] },
          uPixel: { value: 0.002 },
          uTime: { value: 0 },
          uReveal: { value: 0 },
          uStress: { value: s.stress },
          uAmp: { value: s.amp },
          uPetalsA: { value: s.petalsA },
          uPetalsB: { value: s.petalsB },
          uInk: { value: rgb(SEAL_PALETTE.ink) },
          uInkDeep: { value: rgb(SEAL_PALETTE.inkDeep) },
          uDim: { value: rgb(SEAL_PALETTE.dim) },
          uMid: { value: rgb(SEAL_PALETTE.mid) },
          uLit: { value: rgb(SEAL_PALETTE.lit) },
          uAlarm: { value: rgb(SEAL_PALETTE.alarm) },
          uAlarmLit: { value: rgb(SEAL_PALETTE.alarmLit) },
        },
      });
      // ogl only warns on a failed link; without this check a silent black
      // rectangle would replace the SVG seal.
      if (!gl.getProgramParameter(program.program, gl.LINK_STATUS)) {
        throw new Error("rosette shader failed to link");
      }

      const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.display = "block";
      el.appendChild(canvas);

      const resize = () => {
        const r = el.getBoundingClientRect();
        const w = Math.max(1, Math.round(r.width));
        const h = Math.max(1, Math.round(r.height));
        renderer!.setSize(w, h);
        program.uniforms.uResolution.value = [w, h];
        // one device pixel, expressed in the plate units the shader works in
        program.uniforms.uPixel.value = 2 / Math.min(w, h);
      };
      resize();
      observer = new ResizeObserver(resize);
      observer.observe(el);

      const CUT_MS = 1900;
      const start = performance.now();

      const tick = (now: number) => {
        frame = requestAnimationFrame(tick);
        const elapsed = now - start;
        // the burin cuts outward, decelerating as it reaches the rim
        const p = Math.min(1, elapsed / CUT_MS);
        program.uniforms.uReveal.value = 1 - Math.pow(1 - p, 3);
        program.uniforms.uTime.value = elapsed / 1000;

        const cur = latest.current;
        program.uniforms.uStress.value = cur.stress;
        program.uniforms.uAmp.value = cur.amp;
        program.uniforms.uPetalsA.value = cur.petalsA;
        program.uniforms.uPetalsB.value = cur.petalsB;

        renderer!.render({ scene: mesh });

        if (!announced) {
          announced = true;
          onReady();
        }
      };
      frame = requestAnimationFrame(tick);
    } catch {
      onFail();
    }

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      canvas?.remove();
      // Browsers cap live WebGL contexts; a route change must give this one up.
      const lose = renderer?.gl?.getExtension("WEBGL_lose_context");
      lose?.loseContext();
    };
    // Deliberately mount-once. Live values reach the shader through `latest`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={host} className="absolute inset-0" aria-hidden />;
}
