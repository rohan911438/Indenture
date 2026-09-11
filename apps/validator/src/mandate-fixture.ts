/**
 * The mandate YAML, embedded as a string. A Cloudflare Worker has no fs, and
 * the real Validator reads the current mandate from the mandate HCS topic via
 * the mirror node - this fixture is only the MOCK source's stand-in until that
 * wiring lands. Keep it in sync with mandates/fund-one.yaml.
 */
export const MANDATE_YAML_FIXTURE = `# The fund's mandate. Authored here, compiled to canonical JSON, hashed.
# The hash is what the Validator, MandatePolicy, and the HCS journal agree on.
# Covenants are integer-only so the on-chain check is a fixed-width compare.
#
# Compile / hash:  npm run compile -w @indenture/mandate -- mandates/fund-one.yaml
#
# NOTE: the addresses below are MOCKS for local dev. On deploy, regenerate this
# file from contracts/deployments.json and re-run \`amend()\` with the new hash.

version: 1
name: Fund One

vault: "0x3be7042D043924CC4114859a66b6a3Fc43b69047"   # IndentureVault
quote: "0x9812460f054E4a59ef5348bb0996e2888a37D908"   # MockUSDC, 6dp — the cash reserve

covenants:
  maxPositionBps: 3000        # no single asset above 30% of NAV
  minCashBps: 1000            # keep at least 10% in the quote currency
  maxTradeNotional: "250000000000"     # 250,000 USDC (6dp) per trade
  maxDailyNotional: "1000000000000"    # 1,000,000 USDC (6dp) rolling 24h
  # A price feed older than this and the Validator refuses to sign. MUST be >=
  # the feed heartbeat: Chainlink's Hedera feeds beat every 86400s, so anything
  # below that refuses healthy feeds and bricks the fund. See docs/RESEARCH.md
  # section 2.1. Judged off-chain only - the hook never sees it.
  feedStaleAfterSec: 90000             # 86400s heartbeat + margin

universe:
  - "0x5248468473Fe5667A4990E3458ca8b862d8DbA66"   # the risk asset

priceFeeds:
  # asset -> Chainlink AggregatorV3 feed. Read by the Validator ONLY.
  "0x5248468473Fe5667A4990E3458ca8b862d8DbA66": "0x59bC155EB6c6C415fE43255aF66EcF0523c92B4a"
`;
