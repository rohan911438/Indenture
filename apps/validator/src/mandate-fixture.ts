/**
 * The mandate YAML, embedded as a string. A Cloudflare Worker has no fs, and
 * the real Validator reads the current mandate from the mandate HCS topic via
 * the mirror node - this fixture is only the MOCK source's stand-in until that
 * wiring lands. Keep it in sync with mandates/fund-one.yaml.
 */
export const MANDATE_YAML_FIXTURE = `version: 1
name: Fund One
vault: "0x00000000000000000000000000000000000000b0"
quote: "0x00000000000000000000000000000000000000c0"
covenants:
  maxPositionBps: 3000
  minCashBps: 1000
  maxTradeNotional: "250000000000"
  maxDailyNotional: "1000000000000"
universe:
  - "0x00000000000000000000000000000000000000d0"
  - "0x00000000000000000000000000000000000000d1"
priceFeeds:
  "0x00000000000000000000000000000000000000d0": "0x00000000000000000000000000000000000000e0"
  "0x00000000000000000000000000000000000000d1": "0x00000000000000000000000000000000000000e1"
`;
