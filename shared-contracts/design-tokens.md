# Design tokens

**Concept:** a security-engraved financial instrument that happens to be alive.
The product's own vocabulary — mandate, covenant, journal, breach, indenture —
is a 19th-century legal-document register, and real bearer bonds carry guilloché
rosettes, intaglio relief, an embossed seal, bone stock and ruled ledger
columns. The surfaces use that vocabulary, not a crypto dashboard's.

The organising principle is **ornament that is data**. On a real certificate the
engraving is an anti-counterfeit device: information encoded as decoration. Here
the hero seal is driven by live covenant headroom, so the ornament is literally
the fund's state. Nothing is decorative that could be carrying a measurement.

> **History.** This document previously froze a broadsheet treatment — a single
> 760px column, hairline rules, tracked-out capital eyebrows, `A · B · C` meta
> strings — and pointed at `indenture-mockup.html` as the reference. That
> treatment was replaced deliberately, not drifted away from. The mockup is
> retained as a historical artefact and is **no longer the reference.** The
> palette's four original colours are unchanged; what follows is how they are
> used now.

## Colour

Tokens live in `apps/web/app/globals.css` `:root` and are mirrored into
`apps/web/tailwind.config.ts` as `theme.extend.colors`.

The frozen four (ink, bone, brass, oxblood) are unchanged. Each now has the
variants its surfaces need, and **the split is by job, not by taste** — the
reason is measured contrast, below.

```css
/* ground */
--ink:          #14181D;  /* base */
--ink-deep:     #0B0E12;  /* recessed: vignette, seal well, pressed insets */
--ink-raised:   #1B2027;  /* raised surfaces */

/* the certificate band */
--bone:         #E8E3D3;  /* printed stock */
--bone-deep:    #DBD5C2;  /* its own shade */

/* brass — approved, healthy, engraved */
--brass-dim:    #6E5828;  /* engraving shadow · secondary text ON bone */
--brass:        #A6863C;  /* approved · healthy · text on ink */
--brass-bright: #D9B66A;  /* engraving highlight · focus ring */

/* oxblood — refused, breached */
--oxblood:      #6B2737;  /* fill · seal well · refusal text ON bone */
--oxblood-edge: #9E3A50;  /* the 2px rule that means "a refusal is here" */
--oxblood-lit:  #C8606F;  /* refusal text ON ink */

/* neutrals */
--slate:        #4A5560;  /* strokes, disabled — never body text */
--slate-lit:    #7C8794;  /* secondary text on ink */
--signal:       #F5F2EA;  /* primary text on ink */

/* rules */
--hairline:      rgba(245, 242, 234, 0.12);
--hairline-bone: rgba(20, 24, 29, 0.16);
```

### Why the lit variants exist

The original three-colour set failed contrast badly as text, and it failed worst
on the single most important signal on the site.

| token | on `--ink` | verdict |
|---|---|---|
| `--oxblood` #6B2737 | **1.73:1** | unreadable — and it was the colour of every refusal |
| `--slate` #4A5560 | **2.42:1** | unreadable — and it was most secondary text |
| `--slate-lit` #7C8794 | 5.03:1 | passes |
| `--oxblood-lit` #C8606F | 4.69:1 | passes |
| `--brass` #A6863C | 5.33:1 | passes |
| `--signal` #F5F2EA | 14.9:1 | passes |

**The palette inverts across the bone band.** Dark surfaces take the lit
variants; printed stock takes the deep ones, where the same colours measure
`--ink` 14.5:1, `--oxblood` 8.39:1 and `--brass-dim` 5.35:1 on `--bone`.

Rules: `--slate` is for strokes and disabled states and must never carry body
text. `--oxblood` is for fills and on-bone text only; refusal text on a dark
surface is `--oxblood-lit`.

## Type

Three families, named by **role** in `tailwind.config.ts` so a component cannot
quietly invent a nineteen-pixel heading.

| Role | Family | Treatment |
|---|---|---|
| `.display` | Newsreader **italic** | `clamp(2.5rem, 5.4vw, 4.75rem)`, leading 1.0 |
| `.heading` | Newsreader roman | `clamp(1.75rem, 3.5vw, 2.75rem)` |
| `.subheading` | Newsreader roman | `clamp(1.375rem, 2.4vw, 1.75rem)` |
| `.lede` | IBM Plex Sans | 20px / 1.55 |
| body | IBM Plex Sans | 17px / 1.65, measure `68ch` |
| `text-meta` | IBM Plex Sans | 15px |
| `.data` / `text-data` | IBM Plex Mono | 13px, **tabular figures always** |
| `text-micro` | either | 11px |

Newsreader's italic is the display face. Mono is for data — hashes, addresses,
sequence numbers, figures — and **never for labels**: a label is not data.

### Removed as template chrome

These are gone from the codebase and must not come back:

- tracked-out ALL-CAPS eyebrow labels above headings
- meta strings joined with middle dots (`A · B · C`)
- `→` or `↗` appended to link text (an external link gets a real mark, set
  outside the link's words, by `components/ui/ExternalLink`)
- monospace used for small labels rather than for data
- accenting one word or figure inside a headline

## Layout

- `max-w-page` **1280px**, 12-column grid, asymmetric placement.
- `max-w-deed` **760px** survives, demoted to what it always should have been:
  the reading measure for a paragraph, not the width of the site.
- Zero border-radius throughout. Edges are rules, and rules are typed.

### Structural devices that carry information

**Rule weights** (`components/ui/Rule`) — the weight *is* the meaning, and there
is no fourth weight because there is no fourth meaning:

| weight | appearance | means |
|---|---|---|
| `hair` | 1px hairline | row separation |
| `covenant` | 2px brass | a covenant boundary — something is enforced here |
| `refusal` | 2px oxblood-edge | a refusal — something was stopped here |

**The sequence rail** (`components/ui/SeqRail`) — real Hedera Consensus Service
sequence numbers in a left gutter, on `/journal` and `/blocked` **only**.
Justified because the content genuinely is a sequence and the numbers are the
network's, not ours. The rail segment carries the row's verdict as a rule
weight, so the wall is scannable down the gutter. Decorative `01 / 02 / 03`
appears nowhere; the landing's pipeline is the one other numbered thing, and it
is numbered because step two cannot happen before step one.

**The source note** (`components/ui/SourceNote`) — one component for the
live-versus-sample label, so every figure on the site declares its provenance in
the same voice. See Honesty, below.

## Motion

- GSAP 3.15 with ScrollTrigger and SplitText, all free for commercial use since
  April 2025. Registered through `components/motion/gsap.ts`.
- **Every timeline is built inside `gsap.matchMedia()` under
  `(prefers-reduced-motion: no-preference)`.** Under `reduce` the build function
  never runs: nothing is hidden, nothing is pinned. Reduced motion is not a
  faster animation, it is no animation.
- Motion is spent on a small number of orchestrated moments, never sprayed as
  fade-and-slide-up on every section:

| moment | trigger |
|---|---|
| hero | one page-load timeline: the headline sets line by line, then the rest follows |
| the seal | engraves outward from the boss, once, on load |
| the pipeline | pinned, scroll-advanced — genuinely sequential content |
| one refusal, taken apart | pinned, scroll-advanced — the centrepiece |
| gauges | fill when scrolled into view |
| certificate band | slight parallax drift |

- Pinning is additionally gated on having room for it (`min-width: 768px` and
  `min-height: 640px`). A pinned panel taller than the viewport puts its own
  content out of reach.
- **Every pinned section renders all of its steps into the DOM regardless.**
  Pinning decides emphasis only, so with JavaScript off, reduced motion set, or
  on a phone, the section is a plain readable list rather than one stuck on step
  one.
- `components/motion/ChoreographyFlag` sets a class before first paint so
  revealed elements are never visible unanimated for a frame, and drops it after
  3s so a page can never be left hidden by a chunk that failed to load.

## Honesty

This is a design rule, not just a data rule, because it is the product's entire
claim.

- Every getter in `lib/data.ts` returns `Sourced<T>` — the value plus whether it
  was read live. **A page showing sample data always says so**, and says it next
  to the figure it applies to, not once in a corner for the whole page.
- Where two figures on one line come from different sources, they carry separate
  labels. The journal being live does not make the share class live.
- Never mix a real verdict with a fixture's sentence, or the reverse. The
  landing's demo narrates a real journaled refusal when one exists and a fixture
  scenario in full when one does not, and says which.
- Empty states are an instruction in the same voice as the copy, never a
  spinner and never a zero dressed up as a statistic. When the journal holds no
  refusals, the hero says so and invites the reader to cause the first one.

## Applied in

`apps/web/`. Tokens are defined once in `apps/web/app/globals.css` `:root` and
mirrored into `apps/web/tailwind.config.ts`.
