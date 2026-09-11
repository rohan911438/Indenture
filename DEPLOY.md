# Deploying Indenture to Hedera testnet

Everything in this file has been rehearsed end to end against a local anvil
chain, for free, using `make deploy-local`. What follows is the same sequence
against a real network. It costs testnet HBAR, which is free but rate-limited,
so the order matters and every step says what it is spending.

Two rules that came out of the rehearsals:

- **Never redeploy the PoolManager.** It is the largest contract in the repo
  (24,009 of 24,576 bytes) and everything else is wired to its address.
- **Estimate before you broadcast.** Run any `forge script` without
  `--broadcast` first. It simulates and prints gas, and costs nothing.

---

## 0. What I need from you

I cannot create accounts, hold keys, or click through dashboards. These are
the only things actually blocked on you. Everything else in this repo is
written and tested.

| What | Where to get it | Used by |
|---|---|---|
| Hedera testnet account, **ECDSA type** | [portal.hedera.com](https://portal.hedera.com) | deploys, HCS topics |
| A Vercel account | [vercel.com](https://vercel.com), sign in with GitHub | Validator + prospectus |
| Two throwaway EVM private keys | generated locally, see below | Validator signer, Manager |
| Upstash Redis (optional) | Vercel dashboard, Storage tab | nonce lock, see section 6 |
| An LLM API key (optional) | any provider | `LlmProposer` only |

The Hedera portal gives you 1000 testnet HBAR, refilled daily. That is more
than enough for the whole sequence several times over.

**Pick ECDSA, not ED25519, when the portal asks.** ED25519 accounts cannot be
used with Foundry, `cast`, or anything else that speaks EVM. This is the
single most common way to lose an hour here. The portal shows a hex private
key for ECDSA accounts, and that hex key is what Foundry wants.

Generate the two throwaway keys locally:

```bash
node scripts/new-keys.mjs
```

It writes `VALIDATOR_KEY` and `MANAGER_KEY` into `.env` and prints only the
two addresses. `cast wallet new` does the same job, but it prints the private
key to the terminal, and a scrollback buffer during a recorded demo is the
wrong home for the key that signs every receipt this fund issues.

The script refuses to run unless `.env` is genuinely gitignored, and it will
not replace a key that is already real without `--force`. Rotating a deployed
signer silently would leave Vercel signing with one key while the chain
expects another, which surfaces as a bad-signature revert and nothing else.

Keep both addresses. You need them in step 3.

---

## 1. Get the Hedera account, and fill in `.env`

Start at [hedera.com/start-building](https://hedera.com/start-building/) and
follow it through to the **developer portal**, or go straight to
[portal.hedera.com](https://portal.hedera.com). Register, verify the email,
and open the **Testnet** section.

The portal hands you an account. Three details matter:

- **Account ID**, in the form `0.0.123456`. This is the Hedera-native
  identifier and it is what the Consensus Service uses.
- **Key type**. Choose **ECDSA (secp256k1)**. The portal may default to
  ED25519, which is a perfectly good Hedera key and completely unusable from
  Foundry, `cast`, MetaMask, or any other EVM tool. If the account you have
  is ED25519, make a new one rather than trying to work around it.
- **HEX encoded private key**, not the DER encoded one. Foundry wants the hex
  form. DER is the same key in a different envelope and will simply fail to
  parse.

The account arrives with 1000 testnet HBAR and tops back up daily.

Now fill in three values. `scripts/new-keys.mjs` already wrote the other two,
and everything else in the file has a working default.

```bash
HEDERA_OPERATOR_ID=0.0.xxxxxx        # Account ID from the portal
HEDERA_OPERATOR_KEY=0x...            # the HEX ECDSA private key
DEPLOYER_KEY=0x...                   # the same key is fine
```

Confirm the file is still ignored before saving anything real into it:

```bash
git check-ignore -v .env
```

Then check the account is reachable over the EVM relay and actually funded:

```bash
source .env
cast balance $(cast wallet address --private-key $DEPLOYER_KEY) --rpc-url $HEDERA_RPC_URL
```

A non-zero number means the key, the relay, and the funding are all correct,
and it costs nothing to ask. A zero here with HBAR visible in the portal
almost always means the account is ED25519.

---

## 2. Create the two HCS topics

These topics are the entire database. There is no Postgres and no indexer.

```bash
npm run build
node scripts/create-topics.mjs --network testnet
```

It writes `mandateTopicId` and `journalTopicId` into
`contracts/deployments.json` and is idempotent: topics already recorded there
are left alone. Creating a second journal topic would orphan the whole
history, which is why the script refuses to do it.

Cost: a fraction of an HBAR.

---

## 3. Deploy the contracts

Fund the Manager address first. On Hedera, sending HBAR to an EVM address is
what creates the account:

```bash
source .env
cast send <manager-address> --value 20ether \
  --rpc-url $HEDERA_RPC_URL --private-key $DEPLOYER_KEY
```

### Foundry cannot talk to the relay directly. Start the shim.

`forge script` opens a fork and then addresses state with an EIP-1898 block
object. The Hedera relay does not implement EIP-1898, so the **second request
of every run** fails with:

```
Invalid parameter 1: The value passed is not valid: [object Object]
```

The message names neither the method nor the standard, and it happens before
a single transaction is built. `scripts/hedera-rpc-shim.mjs` sits in front of
the relay and rewrites just that one thing. Leave it running in its own shell
for the whole deploy:

```bash
node scripts/hedera-rpc-shim.mjs        # 127.0.0.1:8546 -> hashio
```

Then point Foundry at `http://127.0.0.1:8546` rather than at the relay. `cast`
does not need the shim; it never uses the block-object form.

### The mandate has to be compiled before step 4

`04_Wire.s.sol` reads `contracts/mandate.compiled.json` and fails without it.
The addresses do not exist until step 3 has run, so the order is: deploy 01
through 03, then regenerate and compile the mandate (section 4 below), then
run 04 and 05. Running 04 first fails on a missing file.

### The five scripts

Run each one **without** `--broadcast` first and read the gas estimate.

```bash
export MANAGER_ADDRESS=<manager-address>
export VALIDATOR_ADDRESS=<validator-address>
export RPC=http://127.0.0.1:8546        # the shim, not the relay
cd contracts

forge script script/01_PoolManager.s.sol --rpc-url $RPC --legacy --slow --broadcast
forge script script/02_Hook.s.sol        --rpc-url $RPC --legacy --slow --broadcast
forge script script/03_Vault.s.sol       --rpc-url $RPC --legacy --slow --broadcast
#   ... now do section 4, then come back for:
forge script script/04_Wire.s.sol        --rpc-url $RPC --legacy --slow --broadcast
forge script script/05_Liquidity.s.sol   --rpc-url $RPC --legacy --slow --broadcast
```

`--slow` matters. Hedera finalises differently from an Ethereum testnet, and
sending the next transaction before the previous one settles is how a deploy
half-lands. `--legacy` avoids the EIP-1559 fee path.

A full deploy costs roughly 20 HBAR, most of it the PoolManager at about 8.

Step 2 mines a hook address whose low bits are `0xC0`, because Uniswap v4
reads a hook's permissions out of its address. That is a loop over salts and
it takes a few seconds. It is not stuck.

Each script writes its addresses into `contracts/deployments.json` as it goes.
Check the file after each one.

---

## 4. Point the mandate at the real addresses

The committed `mandates/fund-one.yaml` names placeholder addresses so the
offline suite is deterministic. After a deploy those addresses are wrong, and
a mandate naming addresses that do not exist fails closed on every trade with
a staleness error that points nowhere near the real cause.

First choose a price feed. `regen-mandate.mjs` refuses to run without one, and
it is right to: a mandate that names no feed cannot be valued. Pick a live
Chainlink feed from `docs/RESEARCH.md` section 1.3 and write it into
`contracts/deployments.json` as `contracts.ChainlinkPriceFeed`. HBAR/USD at
`0x59bC155EB6c6C415fE43255aF66EcF0523c92B4a` is the obvious default on Hedera.

Check it answers before you depend on it. This costs nothing:

```bash
cast call <feed> "latestRoundData()(uint80,int256,uint256,uint256,uint80)" --rpc-url $HEDERA_RPC_URL
```

Then:

```bash
cd ..
node scripts/regen-mandate.mjs
npm run --silent compile -w @indenture/mandate -- mandates/fund-one.yaml \
  | sed -n '/^{/,$p' > contracts/mandate.compiled.json
cd contracts && forge script script/04_Wire.s.sol --rpc-url $RPC --legacy --slow --broadcast
cd .. && node scripts/publish-mandate.mjs --action ADOPTED
```

`04_Wire` calls `amend()` with the new mandate hash. The publish step puts the
raw YAML on the mandate topic, which is what makes the rulebook auditable:
anyone can recompute the hash from the document the fund adopted.

Verify the two agree, because this is the failure that costs the most time
later. They must print the same 32 bytes:

```bash
cast call <MandatePolicy> "mandateHash()(bytes32)" --rpc-url $HEDERA_RPC_URL
node -e "console.log(require('./contracts/mandate.compiled.json').hash)"
```

**Regenerating the mandate rewrites two tracked files** — `mandates/fund-one.yaml`
and the Validator's embedded fixture. That is intended after a real deploy:
the committed mandate should name the fund that exists. It is only a problem
after a local anvil rehearsal, which is what `npm run rehearse:reset` undoes.

The covenant numbers are never regenerated. Those are a human decision.
Addresses are a deployment fact, and only the second kind is safe to generate.

---

## 5. Deploy the Validator to Vercel

The Validator runs on either Cloudflare Workers or Vercel from one source.
`apps/validator/src/index.ts` is the app, `apps/validator/api/index.ts` is the
Vercel entry, and `wrangler.toml` is the Cloudflare one. Nothing about a
decision differs between the two hosts.

In the Vercel dashboard:

1. **Add New, then Project**, and import this repository.
2. **Root Directory**: `apps/validator`. Framework preset: **Other**.
3. **Settings, General**: turn ON *Include source files outside of the Root
   Directory in the Build Step*. The Validator imports the workspace packages
   and `contracts/deployments.json`, all of which live above its own folder.
   With this off, the build fails on a missing module.
4. **Settings, Environment Variables**:

   | Name | Value |
   |---|---|
   | `VALIDATOR_KEY` | throwaway key #1, marked **Sensitive** |
   | `CHAIN_ID` | `296` |
   | `HEDERA_RPC_URL` | `https://testnet.hashio.io/api` |
   | `HEDERA_MIRROR_URL` | `https://testnet.mirrornode.hedera.com/api/v1` |

5. Deploy, then check it:

```bash
curl https://<your-validator>.vercel.app/health
```

You want `validator` to be the address of throwaway key #1, and `mandateSeq`
to be a number rather than null. A null `mandateSeq` means it cannot read the
mandate topic, which usually means step 4 has not run.

`apps/validator/vercel.json` already sets the install and build commands to
run from the repository root, and rewrites every path to the function.

---

## 6. The nonce lock, and why you can skip it

Cloudflare gave the Validator a KV namespace holding a short-lived lock, so
two concurrent proposals could not both be signed against one nonce. Vercel
has no equivalent binding, so `apps/validator/src/lock.ts` handles three
cases: the Cloudflare KV binding, an Upstash Redis instance over REST, or
nothing at all.

Add Upstash from the Vercel Storage tab and it sets `KV_REST_API_URL` and
`KV_REST_API_TOKEN` for you. The Validator picks them up with no code change.
Upstash is the better of the two, because `SET NX` is atomic and Workers KV
has no compare-and-set.

If you skip it, the deployment is still correct. This lock only keeps the
journal tidy. `MandatePolicy.seqOf` is the real anti-replay boundary, and only
one signature per nonce can ever land on chain. `GET /health` reports which
lock is in use, so this is never a guess.

---

## 7. Deploy the prospectus

A second Vercel project, from the same repository.

1. **Add New, then Project**, same repository.
2. **Root Directory**: `apps/web`. Framework preset: **Next.js**.
3. Turn ON *Include source files outside of the Root Directory* here too.
4. No environment variables. The site reads addresses from
   `contracts/deployments.json` deliberately, so that what it displays can be
   checked against the repository.

Then tell the site where the Validator lives, by editing that file rather than
by setting a variable:

```json
"services": { "validatorUrl": "https://<your-validator>.vercel.app" }
```

Commit it, and Vercel redeploys both projects. Until it is set, the attack
console runs its scripted sequence and labels itself a rehearsal rather than
showing a refusal that never happened.

---

## 8. GitHub Actions

`.github/workflows/` already contains `agent-tick.yml`, `journaler.yml` and
`ci.yml`. They need repository secrets before they can do anything, under
**Settings, then Secrets and variables, then Actions**.

Add `HEDERA_OPERATOR_ID`, `HEDERA_OPERATOR_KEY`, `MANAGER_KEY` and
`VALIDATOR_URL`. Add `LLM_API_KEY` only if you want the language-model
proposer, since the deterministic `RuleProposer` is the default and needs
nothing.

`VALIDATOR_KEY` never goes into GitHub. It lives in exactly one place, which
is the Vercel environment.

---

## 9. One real trade

You do not need the Validator deployed to do this. Run it locally against the
live chain, in its own shell:

```bash
set -a && . ./.env && set +a
npm run dev:node -w @indenture/validator      # http://127.0.0.1:8787
curl http://127.0.0.1:8787/health
```

Then, with `VALIDATOR_URL` pointing at it:

```bash
npm run tick -w @indenture/manager        # propose, get a receipt, submit
npm run tick -w @indenture/journaler      # copy what happened onto HCS
```

Then fire the three attacks and watch them refuse:

```bash
npm run inject -w @indenture/manager -- --scenario drain
npm run inject -w @indenture/manager -- --scenario overspend
npm run inject -w @indenture/manager -- --scenario stale
```

The demo is working when all four of these are true.

- HashScan shows the `Executed` event on the vault.
- The journal topic shows the trade, journaled by the journaler.
- The prospectus `/blocked` page shows the refusals, with their reasons.
- Each reason names a covenant, not a model's opinion.

### The fund has to have something to rebalance

`RuleProposer` only sells positions that are **above** the mandate's position
cap. A freshly seeded vault is usually under it, so the honest output is a
zero-size proposal and no trade. To have a live demo, mint the mocks until the
risk asset is a little over the cap:

```bash
cast send <MockAsset> "mint(address,uint256)" <vault> <amount> --rpc-url $HEDERA_RPC_URL --private-key $DEPLOYER_KEY --legacy
```

Aim for **slightly** over. The gap has to be closeable within
`maxTradeNotional` or the Validator approves a trade the hook then refuses.

### The pool price and the feed price are two different numbers

The covenants are valued at the **Chainlink** price. The swap is executed at
the **pool** price. On a real fund arbitrage keeps those together; with a mock
asset and a hand-seeded pool they can differ by several times over, and then
the Validator and the hook disagree about what a trade is worth. On this
deployment the pool was about 5x the feed, so a rebalance the Validator sized
at 125,000 quote units arrived at the hook as 624,000 and was refused for
`CovenantTradeNotional`.

That refusal is the system working. It is still a seeding problem, and the fix
is to seed the pool near the feed's price rather than to loosen a covenant.

---

## What breaks, and what it means

| Symptom | Cause |
|---|---|
| `StaleMandate` on the first trade | step 4 was skipped, or `amend()` was not re-run after regenerating |
| Validator health shows `mandateSeq: null` | the mandate has not been published to the topic yet |
| Foundry cannot sign | the account is ED25519. Create an ECDSA one |
| `cast` rejects the private key | you copied the DER form. Use the HEX one |
| `cast balance` is 0 but the portal shows HBAR | same ED25519 problem, seen from the EVM side |
| Vercel build cannot find `@indenture/receipt` | *Include source files outside of the Root Directory* is off |
| Attack console does nothing in the browser | `services.validatorUrl` is empty in `deployments.json` |
| `npm run test:ts` fails after a local rehearsal | run `npm run rehearse:reset`. Not a code bug |
| `Invalid parameter 1 ... [object Object]` | Foundry is talking to the relay directly. Use the shim, section 3 |
| `forge script` cannot find `mandate.compiled.json` | compile the mandate before `04_Wire`, section 4 |
| A proposal of `-0` and no trade | the fund is under the position cap. Nothing to rebalance |
| Validator approves, hook reverts `CovenantTradeNotional` | the pool price and the feed price disagree. Section 9 |
| Revert prints only `0x90bfb865` | that is v4's `WrappedError`. The real reason is nested inside it |
