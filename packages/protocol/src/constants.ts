/** Public ID prefixes per CLAUDE.md section 50. */
export const ID_PREFIX = {
  publisher: "pub_",
  placement: "plc_",
  intent: "int_",
  opportunity: "opp_",
  agent: "agt_",
  campaign: "cmp_",
  delivery: "del_",
  payment: "pay_",
} as const;

export type IdKind = keyof typeof ID_PREFIX;

/** Intent TTL rules per CLAUDE.md section 9. */
export const INTENT_DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
export const INTENT_MAX_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days

/** Opportunity TTL per CLAUDE.md section 13. */
export const OPPORTUNITY_TTL_SECONDS = 5 * 60; // 5 minutes

/** Semantic summary max length per CLAUDE.md section 9. */
export const SEMANTIC_SUMMARY_MAX_LENGTH = 280;

/** Payment network/asset defaults per CLAUDE.md section 5. */
export const HEDERA_TESTNET_NETWORK = "hedera:testnet" as const;
export const HBAR_ASSET_ID = "0.0.0" as const;
export const HBAR_DECIMALS = 8;
export const DEFAULT_REACH_PRICE_TINYBAR = "100000";
