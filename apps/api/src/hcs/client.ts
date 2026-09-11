import { Client, PrivateKey } from "@hiero-ledger/sdk";
import { config } from "../config.js";

let cachedClient: Client | undefined;

/**
 * The API's own Hedera testnet client for the HCS audit trail (CLAUDE.md
 * section 35) - separate from the agents' payer wallets and from Blocky402's
 * facilitator role. Reuses the HEDERA_PAY_TO_ACCOUNT_ID account as its own
 * operator (HEDERA_PAY_TO_PRIVATE_KEY), since that account already exists
 * and is funded for this demo.
 *
 * Returns undefined (never throws) when the operator key isn't configured -
 * HCS is optional/best-effort, never a hard dependency of the payment flow.
 */
export function getHcsClient(): Client | undefined {
  if (cachedClient) return cachedClient;
  if (!config.hederaPayToAccountId || !config.hederaOperatorPrivateKey) return undefined;

  try {
    const client = Client.forTestnet();
    client.setOperator(config.hederaPayToAccountId, PrivateKey.fromStringECDSA(config.hederaOperatorPrivateKey));
    cachedClient = client;
    return client;
  } catch (error) {
    console.error("Failed to construct the HCS operator client (non-fatal):", error);
    return undefined;
  }
}
