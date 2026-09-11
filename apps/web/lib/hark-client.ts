import "server-only";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import type {
  Campaign,
  CreateIntentInput,
  HarkIntent,
  HarkOpportunity,
  ReachConfirmation,
  UpdateIntentInput,
} from "@hark-protocol/protocol";
import { HarkAdvertiserClient, HarkApiError, HarkPublisherClient, type DiscoveryDocument } from "@hark-protocol/sdk";

const packageDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(packageDir, "..", "..", "..", ".env") });

const harkApiUrl = process.env.HARK_API_URL ?? "http://localhost:4021";
const publisherKey = process.env.DEMO_PUBLISHER_KEY ?? "";

/**
 * Server-only clients from @hark-protocol/sdk (CLAUDE.md section 20). The
 * publisher client carries DEMO_PUBLISHER_KEY - this module is marked
 * "server-only" precisely so that secret can never reach a browser bundle;
 * every UI call to a publisher-authenticated operation must go through a
 * Server Action or same-origin Route Handler that imports from here.
 */
const publisherClient = new HarkPublisherClient({ baseUrl: harkApiUrl, publisherKey });
const advertiserClient = new HarkAdvertiserClient({ baseUrl: harkApiUrl });

export { HarkApiError };

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      (body as { error?: { message?: string } })?.error?.message ?? `Hark API error: ${res.status}`;
    const code = (body as { error?: { code?: string } })?.error?.code;
    throw new HarkApiError(res.status, message, code);
  }
  return body as T;
}

export type { DiscoveryDocument };

export async function getDiscovery(): Promise<DiscoveryDocument> {
  return advertiserClient.discovery.get();
}

export type PublisherWithPlacements = {
  id: string;
  slug: string;
  name: string;
  domain?: string;
  placements: Array<{ id: string; slug: string; name: string; format: string }>;
};

// No SDK method for this - it's a Hark-specific demo/discovery convenience
// (CLAUDE.md section 12/23), not part of the protocol's core client surface.
export async function listPublishers(): Promise<PublisherWithPlacements[]> {
  const res = await fetch(`${harkApiUrl}/v1/publishers`, { cache: "no-store" });
  const body = await parseJsonOrThrow<{ items: PublisherWithPlacements[] }>(res);
  return body.items;
}

export async function createIntent(input: CreateIntentInput): Promise<HarkIntent> {
  return publisherClient.intents.create(input);
}

export async function updateIntent(intentId: string, input: UpdateIntentInput): Promise<HarkIntent> {
  return publisherClient.intents.update(intentId, input);
}

export async function revokeIntent(
  intentId: string,
  reason: "fulfilled" | "user_requested" | "issuer_invalidated" | "other" = "user_requested",
): Promise<HarkIntent> {
  return publisherClient.intents.revoke(intentId, reason);
}

export async function getFeed(subjectRef: string) {
  return publisherClient.feed.get(subjectRef);
}

export async function markDeliveryServed(deliveryId: string) {
  return publisherClient.deliveries.markServed(deliveryId);
}

export type DemoEventDto = {
  id: string;
  type: string;
  actor: string;
  data: unknown;
  createdAt: string;
};

// No SDK method for this either - demo-only observability (CLAUDE.md section 22).
export async function listDemoEvents(limit = 100): Promise<DemoEventDto[]> {
  const res = await fetch(`${harkApiUrl}/v1/demo-events?limit=${limit}`, { cache: "no-store" });
  const body = await parseJsonOrThrow<{ items: DemoEventDto[] }>(res);
  return body.items;
}

export async function listCampaigns(): Promise<Campaign[]> {
  return advertiserClient.campaigns.list();
}

export type ExplorerSummary = {
  publishers: Array<{ id: string; slug: string; name: string; domain?: string }>;
  campaigns: Campaign[];
  activeIntentTopicCounts: Array<{ topicId: string; count: number }>;
  opportunities: HarkOpportunity[];
  recentDeliveries: Array<{
    id: string;
    campaignId: string;
    publisherId: string;
    placementId: string;
    status: string;
    payment: { network: string; asset: string; amountTinybar: string; transactionId?: string };
    createdAt: string;
    servedAt?: string;
  }>;
  hcsAuditTopicId?: string;
};

// No SDK method for this - Hark Explorer's own aggregate endpoint (CLAUDE.md section 23).
export async function getExplorerSummary(): Promise<ExplorerSummary> {
  const res = await fetch(`${harkApiUrl}/v1/explorer/summary`, { cache: "no-store" });
  return parseJsonOrThrow(res);
}

export type { Campaign, HarkIntent, HarkOpportunity, ReachConfirmation };
