import { TopicMessageSubmitTransaction } from "@hiero-ledger/sdk";
import { getHcsClient } from "./client.js";
import { getOrCreateAuditTopicId } from "./topic.js";

/**
 * Public HCS audit message shape (CLAUDE.md section 35). Deliberately
 * excludes subjectRef, semanticSummary, and any user identity - HCS messages
 * are public and effectively permanent, so only already-advertiser-visible
 * fields (agent/campaign/publisher ids, topic, price, settled tx id) go in.
 */
export type ReachSettledAuditEvent = {
  schema: "hark.audit.v1";
  event: "reach.settled";
  agentId: string;
  campaignId: string;
  publisherId: string;
  topic: string;
  amountTinybar: string;
  transactionId: string;
  timestamp: string;
};

/**
 * Best-effort: never throws. The HCS audit trail is a bonus feature layered
 * on top of the mandatory x402/Hedera paid-reach flow - a Hedera hiccup here
 * must never surface as a payment/delivery failure (mirrors the same
 * never-fail posture as the settlement backfill in resource-server.ts).
 */
export async function recordReachSettledAudit(
  event: Omit<ReachSettledAuditEvent, "schema" | "event" | "timestamp">,
): Promise<void> {
  try {
    const client = getHcsClient();
    if (!client) return;

    const topicId = await getOrCreateAuditTopicId();
    if (!topicId) return;

    const payload: ReachSettledAuditEvent = {
      schema: "hark.audit.v1",
      event: "reach.settled",
      timestamp: new Date().toISOString(),
      ...event,
    };

    const response = await new TopicMessageSubmitTransaction({
      topicId,
      message: JSON.stringify(payload),
    }).execute(client);
    await response.getReceipt(client);
  } catch (error) {
    console.error("Failed to submit HCS audit message (non-fatal):", error);
  }
}
