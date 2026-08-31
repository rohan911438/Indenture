# @indenture/web — the prospectus

Next.js 15 App Router. **No API routes.** Reads the fund straight from the
Hedera mirror node + RPC; today it reads `mocks/*.json` instead.

## Routes

| Route | What it shows |
|---|---|
| `/` (Mandate) | `MandateHero` from the compiled covenants · plain NAV number · 4 `CovenantGauge`s |
| `/journal` | every RECEIPT + BREACH, approved and refused, newest first |
| `/blocked` | refusals + breaches only — the demo's centrepiece |
| `/shares` | ERC-3643 class facts + subscribe/redeem with the **exact** refusal reason |

## The seam

`lib/data.ts` is the only module that knows where data comes from. Nothing
else imports `mocks/`. Each function has a `TODO(real)` one-liner for the
Mirror Node / wagmi call that replaces it.

To switch to live data:

1. populate `contracts/deployments.json` (`hcs.journalTopicId`, addresses)
2. set `NEXT_PUBLIC_USE_MOCKS=false`
3. in `lib/data.ts`, replace the `*.json` reads with `readTopic()` from
   `@indenture/hedera/mirror` (wrap in TanStack Query, 5s refetch) and the
   contract reads with wagmi/viem

If a component in `components/` has to change, a mock shape in `mocks/` didn't
match `shared-contracts/` — fix the mock, not the component.

## Design

Frozen in `shared-contracts/design-tokens.md`. Reference: `indenture-mockup.html`
at the repo root — open it in a browser. Tokens live in `app/globals.css`
`:root`, mirrored into `tailwind.config.ts`.

## Dev

```bash
npm run dev -w @indenture/web     # :3000
npm run build -w @indenture/web   # static prerender of all routes
npm run lint -w @indenture/web    # tsc --noEmit
```
