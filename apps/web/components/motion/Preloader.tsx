"use client";

import { useEffect, useRef, useState } from "react";
import { gsap, useGSAP } from "./gsapPaper";
import { Logo } from "@/components/brand/Logo";
import { D, E } from "@/lib/motion";

const SEEN = "indenture:preloaded";

/**
 * Decides, before first paint, whether this load gets a preloader.
 *
 * It has to be a blocking script and it has to run here rather than in an
 * effect: mounting the overlay after hydration meant ~700ms of hero, then a
 * black screen dropping over it, which is worse than having no preloader at
 * all. The markup is server-rendered and CSS-hidden; this is the only thing
 * that shows it.
 *
 * Three ways to not run: the reader asked for less motion, they have already
 * seen it this session, or scripts are off — in which case the attribute is
 * never set and the overlay stays display:none forever.
 */
const FLAG = `try{
if(matchMedia('(prefers-reduced-motion: no-preference)').matches
   && !sessionStorage.getItem('${SEEN}')){
  sessionStorage.setItem('${SEEN}','1');
  document.documentElement.setAttribute('data-preload','1');
}
}catch(e){}`;

export function PreloaderFlag() {
  return <script dangerouslySetInnerHTML={{ __html: FLAG }} />;
}

/**
 * First visit only, under two seconds, skippable on click.
 *
 * The halves wipe on from the outside and meet at the seam — the two pieces of
 * the instrument being brought together — while a counter runs to 100. The
 * final wipe overlaps the hero reveal rather than finishing before it; queued,
 * the two would read as a loading screen handing over to a page.
 */
export function Preloader() {
  const [show, setShow] = useState(true);
  const root = useRef<HTMLDivElement>(null);
  const skip = useRef<(() => void) | null>(null);

  // The flag script is the authority. No attribute, no preloader.
  useEffect(() => {
    if (document.documentElement.getAttribute("data-preload") !== "1") {
      setShow(false);
    }
  }, []);

  useGSAP(
    () => {
      if (!show) return;
      const el = root.current;
      if (!el) return;
      if (document.documentElement.getAttribute("data-preload") !== "1") return;

      const mark = el.querySelector<HTMLElement>(".mark");
      const count = el.querySelector<HTMLElement>("[data-count]");
      const n = { v: 0 };

      const tl = gsap.timeline({
        onComplete: () => {
          document.documentElement.removeAttribute("data-preload");
          setShow(false);
        },
      });

      // Each half stops at its own resting inset — 44.9% and 55.1%, the two
      // sides of the seam — so they converge on it rather than past it.
      tl.fromTo(
        mark,
        { "--wipe-a": "100%" },
        { "--wipe-a": "44.9%", duration: 0.9, ease: E.inOut },
        0,
      )
        .fromTo(
          mark,
          { "--wipe-b": "100%" },
          { "--wipe-b": "55.1%", duration: 0.9, ease: E.inOut },
          0.12,
        )
        .to(
          n,
          {
            v: 100,
            duration: 1,
            ease: E.inOut,
            snap: { v: 1 },
            onUpdate: () => {
              if (count) count.textContent = String(Math.round(n.v)).padStart(3, "0");
            },
          },
          0,
        )
        .to(mark, { scale: 1.06, duration: 0.2, ease: E.out })
        .to(el, { clipPath: "inset(0 0 100% 0)", duration: D.md, ease: E.big });

      skip.current = () => tl.progress(1);
      return () => tl.kill();
    },
    { dependencies: [show], scope: root },
  );

  if (!show) return null;

  return (
    <div
      ref={root}
      className="preloader"
      style={{ clipPath: "inset(0 0 0 0)" }}
      onClick={() => skip.current?.()}
      role="presentation"
    >
      <div className="flex flex-col items-center gap-10">
        <Logo variant="stacked" size={64} state="drawing" />
        <span className="t-data-sm" style={{ color: "var(--on-dark-2)" }} data-count>
          000
        </span>
      </div>
    </div>
  );
}
