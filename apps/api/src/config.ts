import { fileURLToPath } from "node:url";
import path from "node:path";
import { config as loadEnv } from "dotenv";

const packageDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(packageDir, "..", "..", "..", ".env") });

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  apiPort: Number.parseInt(process.env.API_PORT ?? "4021", 10),
  databaseUrl: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/hark",
  harkApiUrl: process.env.HARK_API_URL ?? "http://localhost:4021",
  webUrl: process.env.WEB_URL ?? "http://localhost:3000",
  reachPriceTinybar: process.env.HARK_REACH_PRICE_TINYBAR ?? "100000",
  hederaNetwork: process.env.HEDERA_NETWORK ?? "hedera:testnet",
  blocky402FacilitatorUrl:
    process.env.BLOCKY402_FACILITATOR_URL ?? "https://api.testnet.blocky402.com",
  hederaPayToAccountId: process.env.HEDERA_PAY_TO_ACCOUNT_ID ?? "",
} as const;
