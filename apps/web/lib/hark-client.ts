import "server-only";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import type {
  Campaign,
  CreateIntentInput,
  FeedDelivery,
  HarkIntent,
  HarkOpportunity,
  ReachConfirmation,
  UpdateIntentInput,
} from "@hark-protocol/protocol";

const packageDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(packageDir, "..", "..", "..", ".env") });

const harkApiUrl = process.env.HARK_API_URL ?? "http://localhost:4021";
const publisherKey = process.env.DEMO_PUBLISHER_KEY ?? "";

function authHeaders(): Record<string, string> {
  return { authorization: `Bearer ${publisherKey}` };
}

class HarkApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      (body as { error?: { message?: string } })?.error?.message ?? `Hark API error: ${res.status}`;
    throw new HarkApiError(res.status, message);
  }
  return body as T;
}

export { HarkApiError };

export type DiscoveryDocument = {
  name: string;
  protocolVersion: string;
  network: string;
  paymentProtocol: string;
  asset: string;
};

export async function getDiscovery(): Promise<DiscoveryDocument> {
  const res = await fetch(`${harkApiUrl}/.well-known/hark.json`, { cache: "no-store" });
  return parseJsonOrThrow(res);
}

export type PublisherWithPlacements = {
  id: string;
  slug: string;
  name: string;
  domain?: string;
  placements: Array<{ id: string; slug: string; name: string; format: string }>;
};

export async function listPublishers(): Promise<PublisherWithPlacements[]> {
  const res = await fetch(`${harkApiUrl}/v1/publishers`, { cache: "no-store" });
  const body = await parseJsonOrThrow<{ items: PublisherWithPlacements[] }>(res);
  return body.items;
}

export async function createIntent(input: CreateIntentInput): Promise<HarkIntent> {
  const res = await fetch(`${harkApiUrl}/v1/intents`, {
    method: "POST",
    headers: { "content-type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  return parseJsonOrThrow(res);
}

export async function updateIntent(intentId: string, input: UpdateIntentInput): Promise<HarkIntent> {
  const res = await fetch(`${harkApiUrl}/v1/intents/${intentId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  return parseJsonOrThrow(res);
}

export async function revokeIntent(
  intentId: string,
  reason: "fulfilled" | "user_requested" | "issuer_invalidated" | "other" = "user_requested",
): Promise<HarkIntent> {
  const res = await fetch(`${harkApiUrl}/v1/intents/${intentId}`, {
    method: "DELETE",
    headers: { "content-type": "application/json", ...authHeaders() },
    body: JSON.stringify({ reason }),
    cache: "no-store",
  });
  return parseJsonOrThrow(res);
}

export async function getFeed(subjectRef: string): Promise<FeedDelivery[]> {
  const res = await fetch(`${harkApiUrl}/v1/feed/${encodeURIComponent(subjectRef)}`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  const body = await parseJsonOrThrow<{ items: FeedDelivery[] }>(res);
  return body.items;
}

export async function markDeliveryServed(deliveryId: string): Promise<FeedDelivery> {
  const res = await fetch(`${harkApiUrl}/v1/deliveries/${deliveryId}/served`, {
    method: "POST",
    headers: authHeaders(),
    cache: "no-store",
  });
  return parseJsonOrThrow(res);
}

export type DemoEventDto = {
  id: string;
  type: string;
  actor: string;
  data: unknown;
  createdAt: string;
};

export async function listDemoEvents(limit = 100): Promise<DemoEventDto[]> {
  const res = await fetch(`${harkApiUrl}/v1/demo-events?limit=${limit}`, { cache: "no-store" });
  const body = await parseJsonOrThrow<{ items: DemoEventDto[] }>(res);
  return body.items;
}

export async function listCampaigns(): Promise<Campaign[]> {
  const res = await fetch(`${harkApiUrl}/v1/campaigns`, { cache: "no-store" });
  const body = await parseJsonOrThrow<{ items: Campaign[] }>(res);
  return body.items;
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
};

export async function getExplorerSummary(): Promise<ExplorerSummary> {
  const res = await fetch(`${harkApiUrl}/v1/explorer/summary`, { cache: "no-store" });
  return parseJsonOrThrow(res);
}

export type { Campaign, HarkIntent, HarkOpportunity, ReachConfirmation };
