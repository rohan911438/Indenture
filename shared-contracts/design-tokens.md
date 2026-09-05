# Design tokens — frozen

**Concept:** a live bond-trust deed, not a crypto dashboard. The product's own
vocabulary — mandate, covenant, journal, breach — is a 19th-century
legal-document register. Ledger pages, hairline rules, real sequence numbers
(justified: the content genuinely is sequential HCS data). No rounded SaaS
cards, no cream+terracotta, no neon-on-black.

**Reference mockup:** `indenture-mockup.html` at the repo root — open it
directly in a browser. It shows the token system applied to the home hero + the
`/blocked` wall. Match it, don't reinterpret it.

## Colour

```css
--ink:        #14181D;  /* base background */
--ink-raised: #1B2027;  /* raised surfaces, if needed */
--bone:       #E8E3D3;  /* only if a light surface is ever needed */
--brass:      #A6863C;  /* approved / positive / healthy gauge */
--oxblood:    #6B2737;  /* refused / breach / warning gauge */
--slate:      #4A5560;  /* secondary text, borders, timestamps */
--signal:     #F5F2EA;  /* primary text on dark */
--hairline:   rgba(245, 242, 234, 0.12);
```

## Type

| Family | Use |
|---|---|
| `Newsreader` (serif, italic-capable) | mandate text, headlines **only** |
| `IBM Plex Sans` | all UI chrome — nav, labels, buttons |
| `IBM Plex Mono` | hashes, addresses, nonces, sequence numbers, gauge values (functional, not decorative) |

## Layout

- Left-aligned, max content width ~760px, generous top margin.
- Hairline dividers between entries, **not** card shadows.
- Numbering only where content is genuinely sequential (`/journal`,
  `/blocked`) — not decorative "01/02/03" elsewhere.
- One motion moment max per page (e.g. the gauge bar fill animates on load).
  No scroll-triggered fade-ins. Respect `prefers-reduced-motion`.
- Every page renders something sensible with zero real data — the empty state
  is an instruction in the same voice as the copy, never a spinner forever.

## Applied in

`apps/web/` (the frontend track). Tokens live in `apps/web/app/globals.css`
`:root` and are mirrored into `apps/web/tailwind.config.ts` as
`theme.extend.colors`.
