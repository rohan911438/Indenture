# shared-contracts/

The frozen wire + event contracts that **both** tracks build against.

- Backend implements these exactly.
- Frontend builds against `frontend/mocks/` (here: `apps/web/mocks/`) whose
  shapes match these files 1:1, then swaps the mock source for the real
  `lib/` client with no component change.

**Rule:** the real shape must not drift from these files without editing the
file in the same commit and pinging the other track.

| File | Contract |
|---|---|
| `validator-api.md` | HTTP wire contract for the Validator Worker (`POST /validate`, `GET /mandate`, `GET /health`). |
| `hcs-envelope-schema.md` | The 4 HCS message types (`MANDATE`, `RECEIPT`, `BREACH`, `CONTEXT`) and every body shape. |
| `contract-events.md` | The Solidity events the journaler and the web app read. |

## Reconciliation note (2026-08-31)

The original master prompt sketched `POST /propose` with an `{ ok: true|false }`
envelope and a 9-field receipt. The scaffold that already exists (green tests,
first commit `582fa3a`) implements the trade boundary as `POST /validate` with a
`{ decision: "APPROVED"|"REFUSED" }` envelope and the 6-field receipt frozen in
`packages/receipt/src/types.ts` + `contracts/src/libs/ReceiptLib.sol`.

These files document **what is actually built and tested**, using the master
prompt's structure. Where the prompt and the scaffold disagreed, the scaffold
won, because it is the thing with a passing signature-recovery vector.
