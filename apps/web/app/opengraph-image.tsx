import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Indenture — the pool that says no.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The card on the ETHGlobal showcase, in Discord and on X. It is seen by more
 * people than the site, so it is generated from code rather than exported once
 * and left to drift.
 *
 * Obsidian ground, the lockup, three lines, one rule, one mono line. Nothing
 * else: no screenshot, no gradient, no logo soup.
 */

/**
 * Satoshi ships as woff2, which satori cannot parse. Plus Jakarta Sans is the
 * declared fallback for exactly this face, so the card uses it and stays
 * consistent with a site whose Satoshi request has failed. If the fetch fails
 * too, satori's default face renders and the card is still correct.
 */
async function jakarta(weight: number, text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@${weight}&text=${encodeURIComponent(text)}`,
      { headers: { "User-Agent": "Mozilla/5.0" } },
    ).then((r) => r.text());
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    return await fetch(url).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

const HEADLINE = "The pool that says no.";
const FOOT = "ETHONLINE 2026 · HEDERA · UNISWAP v4 · CHAINLINK";

export default async function OpengraphImage() {
  const lockup = await readFile(join(process.cwd(), "public/brand/lockup.png"));
  const lockupSrc = `data:image/png;base64,${lockup.toString("base64")}`;

  const [display, mono] = await Promise.all([
    jakarta(500, HEADLINE),
    jakarta(400, FOOT),
  ]);

  const fonts = [
    display && { name: "Display", data: display, weight: 500 as const, style: "normal" as const },
    mono && { name: "Foot", data: mono, weight: 400 as const, style: "normal" as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 500 | 400; style: "normal" }[];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#060606",
          padding: 64,
          position: "relative",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={lockupSrc} alt="" height={56} style={{ objectFit: "contain" }} />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            /* Three 96px lines at 1.05 run 302px tall, and the rule sits at
               520. This is what keeps the descender of "no." off it. */
            marginTop: 70,
            fontFamily: "Display",
            fontSize: 96,
            fontWeight: 500,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            color: "#F4F2EF",
          }}
        >
          <div style={{ display: "flex" }}>The pool</div>
          <div style={{ display: "flex" }}>that says</div>
          {/* The one saturated colour on the card, on the one word that earns it. */}
          <div style={{ display: "flex", color: "#A3222E" }}>no.</div>
        </div>

        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 520,
            height: 1,
            background: "#262320",
          }}
        />

        <div
          style={{
            position: "absolute",
            left: 64,
            top: 556,
            display: "flex",
            fontFamily: "Foot",
            fontSize: 20,
            letterSpacing: "0.06em",
            color: "#8C867E",
          }}
        >
          {FOOT}
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined },
  );
}
