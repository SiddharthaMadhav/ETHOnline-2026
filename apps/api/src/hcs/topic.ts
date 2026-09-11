import { TopicCreateTransaction } from "@hiero-ledger/sdk";
import { config } from "../config.js";
import { getHcsClient } from "./client.js";

let cachedTopicId: string | undefined = config.hcsTopicId || undefined;
let creating: Promise<string | undefined> | undefined;

/**
 * Read-only accessor for display purposes (e.g. the Explorer's frequently
 * polled summary endpoint) - never triggers topic creation. Unlike
 * `getOrCreateAuditTopicId`, this must stay side-effect-free: it's called on
 * every unauthenticated poll, and topic creation should only ever be
 * triggered by an actual settlement.
 */
export function getCachedAuditTopicId(): string | undefined {
  return cachedTopicId;
}

/**
 * Lazily creates the HCS audit topic on first use rather than blocking API
 * startup on it (CLAUDE.md section 35 is a bonus feature - a slow/unhappy
 * Hedera call here must never delay boot or the mandatory payment path).
 * Once created, the id is cached in-memory for the life of this process;
 * the topic id is logged so it can be pinned as HARK_HCS_TOPIC_ID in .env
 * to reuse the same topic across restarts instead of creating a new one
 * every time.
 */
export async function getOrCreateAuditTopicId(): Promise<string | undefined> {
  if (cachedTopicId) return cachedTopicId;
  if (creating) return creating;

  const client = getHcsClient();
  if (!client) return undefined;

  creating = (async () => {
    try {
      const response = await new TopicCreateTransaction({
        topicMemo: "hark-protocol.audit.v1",
      }).execute(client);
      const receipt = await response.getReceipt(client);
      const topicId = receipt.topicId?.toString();
      if (topicId) {
        cachedTopicId = topicId;
        console.log(
          `[hcs] Created audit topic ${topicId}. Pin it as HARK_HCS_TOPIC_ID in .env to reuse it on ` +
            `the next boot instead of creating a new one. HashScan: ` +
            `https://hashscan.io/testnet/topic/${topicId}`,
        );
      }
      return topicId;
    } catch (error) {
      console.error("Failed to create the HCS audit topic (non-fatal):", error);
      return undefined;
    }
  })();

  try {
    return await creating;
  } finally {
    creating = undefined;
  }
}
