import { and, count, desc, eq, gt, isNull } from "drizzle-orm";
import type { HarkDatabase } from "@hark-protocol/db";
import { schema } from "@hark-protocol/db";
import type { HarkOpportunity } from "@hark-protocol/protocol";
import { listActiveCampaigns } from "./campaign-service.js";
import { listOpportunities } from "./opportunity-service.js";
import { getCachedAuditTopicId } from "../hcs/topic.js";

export type ExplorerPublisher = {
  id: string;
  slug: string;
  name: string;
  domain?: string;
};

export type ExplorerTopicCount = {
  topicId: string;
  count: number;
};

export type ExplorerDelivery = {
  id: string;
  campaignId: string;
  publisherId: string;
  placementId: string;
  status: string;
  payment: {
    network: string;
    asset: string;
    amountTinybar: string;
    transactionId?: string;
  };
  createdAt: string;
  servedAt?: string;
};

async function listActivePublishers(db: HarkDatabase): Promise<ExplorerPublisher[]> {
  const rows = await db.query.publishers.findMany({ where: eq(schema.publishers.active, true) });
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    domain: row.domain ?? undefined,
  }));
}

async function getActiveIntentTopicCounts(db: HarkDatabase): Promise<ExplorerTopicCount[]> {
  const rows = await db
    .select({ topicId: schema.intentTopics.topicId, total: count() })
    .from(schema.intentTopics)
    .innerJoin(schema.intents, eq(schema.intents.id, schema.intentTopics.intentId))
    .where(and(gt(schema.intents.expiresAt, new Date()), isNull(schema.intents.revokedAt)))
    .groupBy(schema.intentTopics.topicId)
    .orderBy(desc(count()));

  return rows.map((row) => ({ topicId: row.topicId, count: Number(row.total) }));
}

/** Never includes subjectRef or the internal intentId - CLAUDE.md section 23/24. */
async function listRecentDeliveries(db: HarkDatabase, limit: number): Promise<ExplorerDelivery[]> {
  const rows = await db.query.deliveries.findMany({
    orderBy: desc(schema.deliveries.createdAt),
    limit,
  });

  const results: ExplorerDelivery[] = [];
  for (const row of rows) {
    const payment = row.paymentId
      ? await db.query.payments.findFirst({ where: eq(schema.payments.id, row.paymentId) })
      : undefined;
    results.push({
      id: row.id,
      campaignId: row.campaignId,
      publisherId: row.publisherId,
      placementId: row.placementId,
      status: row.status,
      payment: {
        network: "hedera:testnet",
        asset: "0.0.0",
        amountTinybar: payment?.amountTinybar ?? "0",
        transactionId: payment?.transactionId ?? undefined,
      },
      createdAt: row.createdAt.toISOString(),
      servedAt: row.servedAt?.toISOString() ?? undefined,
    });
  }
  return results;
}

export type ExplorerSummary = {
  publishers: ExplorerPublisher[];
  campaigns: Awaited<ReturnType<typeof listActiveCampaigns>>;
  activeIntentTopicCounts: ExplorerTopicCount[];
  opportunities: HarkOpportunity[];
  recentDeliveries: ExplorerDelivery[];
  /** CLAUDE.md section 35 bonus - undefined until the first real settlement creates one. */
  hcsAuditTopicId?: string;
};

export async function getExplorerSummary(db: HarkDatabase): Promise<ExplorerSummary> {
  const [publishers, campaigns, activeIntentTopicCounts, opportunities, recentDeliveries] = await Promise.all([
    listActivePublishers(db),
    listActiveCampaigns(db),
    getActiveIntentTopicCounts(db),
    listOpportunities(db),
    listRecentDeliveries(db, 20),
  ]);

  return {
    publishers,
    campaigns,
    activeIntentTopicCounts,
    opportunities,
    recentDeliveries,
    hcsAuditTopicId: getCachedAuditTopicId(),
  };
}
