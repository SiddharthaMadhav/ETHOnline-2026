/**
 * Standalone advertiser x402 client (CLAUDE.md sections 18, 52 item 18).
 *
 * Makes one real, live paid POST /v1/reach call against a running Hark API
 * using a real Hedera testnet payer account, settled through Blocky402.
 * This is the minimal client needed to prove the mandatory paid flow end to
 * end - the full agent CLI with LLM relevance scoring is a later phase.
 *
 * Gated behind LIVE_HEDERA_TESTS=1 (CLAUDE.md sections 28, 41) - never runs
 * as part of the ordinary test suite, and refuses to run against placeholder
 * credentials.
 */
import { fileURLToPath } from "node:url";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import { PrivateKey } from "@hiero-ledger/sdk";
import { createClientHederaSigner } from "@x402/hedera";
import { ExactHederaScheme } from "@x402/hedera/exact/client";
import { x402Client } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { decodePaymentResponseHeader } from "@x402/core/http";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(scriptDir, "..", ".env") });

const PLACEHOLDER_ACCOUNT_ID = "0.0.xxxxx";
const PLACEHOLDER_PRIVATE_KEY = "0x...";

function requireLiveGate() {
  if (process.env.LIVE_HEDERA_TESTS !== "1") {
    console.log(
      "Skipping: set LIVE_HEDERA_TESTS=1 to run a real Hedera testnet payment " +
        "(never run this in ordinary test suites).",
    );
    process.exit(0);
  }
}

function requireRealCredentials() {
  const accountId = process.env.AGENT_HEDERA_ACCOUNT_ID ?? "";
  const privateKey = process.env.AGENT_HEDERA_PRIVATE_KEY ?? "";
  const campaignId = process.env.AGENT_CAMPAIGN_ID ?? "";

  if (!accountId || accountId === PLACEHOLDER_ACCOUNT_ID) {
    throw new Error("AGENT_HEDERA_ACCOUNT_ID is not set to a real Hedera testnet account id.");
  }
  if (!privateKey || privateKey === PLACEHOLDER_PRIVATE_KEY) {
    throw new Error("AGENT_HEDERA_PRIVATE_KEY is not set to a real Hedera testnet ECDSA key.");
  }
  if (!campaignId) {
    throw new Error("AGENT_CAMPAIGN_ID is not set - seed a campaign and set its id first.");
  }

  return { accountId, privateKey, campaignId };
}

/** Hedera "0.0.x@seconds.nanos" -> HashScan's "0.0.x-seconds-nanos" URL segment. */
function toHashscanTransactionId(transactionId: string): string {
  const [account, timestamp] = transactionId.split("@");
  if (!timestamp) return transactionId;
  return `${account}-${timestamp.replace(".", "-")}`;
}

async function main() {
  requireLiveGate();
  const { accountId, privateKey, campaignId } = requireRealCredentials();

  const harkApiUrl = process.env.HARK_API_URL ?? "http://localhost:4021";
  const network = process.env.HEDERA_NETWORK ?? "hedera:testnet";

  console.log(`Advertiser agent account: ${accountId}`);
  console.log(`Hark API: ${harkApiUrl}`);

  console.log("discovering opportunities");
  const opportunitiesRes = await fetch(`${harkApiUrl}/v1/opportunities?campaignId=${campaignId}`);
  if (!opportunitiesRes.ok) {
    throw new Error(`GET /v1/opportunities failed: ${opportunitiesRes.status}`);
  }
  const { items } = (await opportunitiesRes.json()) as { items: Array<{ id: string }> };
  if (items.length === 0) {
    console.log("No opportunities available for this campaign right now. Nothing to pay for.");
    return;
  }
  const opportunity = items[0]!;
  console.log(`Selected opportunity: ${opportunity.id}`);

  const idempotencyKey = randomUUID();
  const reachBody = JSON.stringify({ opportunityId: opportunity.id, campaignId });
  const reachHeaders = {
    "content-type": "application/json",
    "x-hark-idempotency-key": idempotencyKey,
  };

  console.log("requesting reach");
  const unpaidRes = await fetch(`${harkApiUrl}/v1/reach`, {
    method: "POST",
    headers: reachHeaders,
    body: reachBody,
  });
  console.log(`received ${unpaidRes.status}${unpaidRes.status === 402 ? " Payment Required" : ""}`);

  console.log("signing Hedera x402 payment");
  const signer = createClientHederaSigner(accountId, PrivateKey.fromStringECDSA(privateKey), {
    network,
  });
  const client = new x402Client().register(network as `${string}:${string}`, new ExactHederaScheme(signer));
  const fetchWithPayment = wrapFetchWithPayment(fetch, client);

  console.log("retrying paid request");
  const paidRes = await fetchWithPayment(`${harkApiUrl}/v1/reach`, {
    method: "POST",
    headers: reachHeaders,
    body: reachBody,
  });

  if (!paidRes.ok) {
    const errorBody = await paidRes.text();
    throw new Error(`Paid POST /v1/reach failed: ${paidRes.status} ${errorBody}`);
  }

  const paymentResponseHeader =
    paidRes.headers.get("payment-response") ?? paidRes.headers.get("x-payment-response");
  if (!paymentResponseHeader) {
    throw new Error("Paid response is missing the PAYMENT-RESPONSE header - cannot confirm settlement.");
  }
  const settlement = decodePaymentResponseHeader(paymentResponseHeader);
  if (!settlement.success) {
    throw new Error(`Settlement failed: ${settlement.errorReason} ${settlement.errorMessage ?? ""}`);
  }

  console.log("payment settled");
  console.log(`transaction id: ${settlement.transaction}`);
  console.log(
    `HashScan: https://hashscan.io/testnet/transaction/${toHashscanTransactionId(settlement.transaction)}`,
  );

  const confirmation = (await paidRes.json()) as { deliveryId: string; status: string };
  console.log(`delivery queued: ${confirmation.deliveryId} (${confirmation.status})`);
}

main().catch((error) => {
  console.error("Live payment smoke test failed:", error);
  process.exitCode = 1;
});
