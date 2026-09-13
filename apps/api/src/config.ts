import { fileURLToPath } from "node:url";
import path from "node:path";
import { config as loadEnv } from "dotenv";

const packageDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(packageDir, "..", "..", "..", ".env") });

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  // PORT is what Railway/most PaaS hosts inject and expect the app to bind to;
  // API_PORT remains the local-dev override (see .env.example).
  apiPort: Number.parseInt(process.env.API_PORT ?? process.env.PORT ?? "4021", 10),
  databaseUrl: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/hark",
  harkApiUrl: process.env.HARK_API_URL ?? "http://localhost:4021",
  webUrl: process.env.WEB_URL ?? "http://localhost:3000",
  reachPriceTinybar: process.env.HARK_REACH_PRICE_TINYBAR ?? "100000",
  hederaNetwork: process.env.HEDERA_NETWORK ?? "hedera:testnet",
  blocky402FacilitatorUrl:
    process.env.BLOCKY402_FACILITATOR_URL ?? "https://api.testnet.blocky402.com",
  hederaPayToAccountId: process.env.HEDERA_PAY_TO_ACCOUNT_ID ?? "",
  // HCS audit trail only (CLAUDE.md section 35) - never used for receiving
  // x402 payments, which don't require the API to hold any Hedera key.
  hederaOperatorPrivateKey: process.env.HEDERA_PAY_TO_PRIVATE_KEY ?? "",
  hcsTopicId: process.env.HARK_HCS_TOPIC_ID ?? "",
  // Publisher revenue share (basis points, 1/100th of a percent). Default
  // 8000 = 80% to the publisher, 20% to the protocol - see the design
  // discussion in docs/STATUS.md for why this leans publisher-favorable.
  publisherShareBps: Number.parseInt(process.env.HARK_PUBLISHER_SHARE_BPS ?? "8000", 10),
  // Minimum accrued balance before a payout run actually transfers HBAR -
  // avoids paying more in Hedera network fees than the payout is worth.
  payoutMinTinybar: process.env.HARK_PAYOUT_MIN_TINYBAR ?? "1000000",
} as const;
