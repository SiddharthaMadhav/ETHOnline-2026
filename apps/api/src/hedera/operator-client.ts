import { Client, PrivateKey } from "@hiero-ledger/sdk";
import { config } from "../config.js";

let cachedClient: Client | undefined;

/**
 * The API's own Hedera testnet client, operated by the HEDERA_PAY_TO_ACCOUNT_ID
 * account (HEDERA_PAY_TO_PRIVATE_KEY) - separate from the agents' payer
 * wallets and from Blocky402's facilitator role. Shared by anything the API
 * itself needs to sign Hedera transactions for: the HCS audit trail
 * (CLAUDE.md section 35) and publisher revenue-share payouts.
 *
 * Returns undefined (never throws) when the operator key isn't configured -
 * both callers treat this as optional/best-effort, never a hard dependency
 * of the mandatory payment path.
 */
export function getOperatorClient(): Client | undefined {
  if (cachedClient) return cachedClient;
  if (!config.hederaPayToAccountId || !config.hederaOperatorPrivateKey) return undefined;

  try {
    const client = Client.forTestnet();
    client.setOperator(config.hederaPayToAccountId, PrivateKey.fromStringECDSA(config.hederaOperatorPrivateKey));
    cachedClient = client;
    return client;
  } catch (error) {
    console.error("Failed to construct the Hedera operator client (non-fatal):", error);
    return undefined;
  }
}
