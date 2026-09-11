import { and, eq, gt, isNull } from "drizzle-orm";
import type { HarkDatabase } from "@hark-protocol/db";
import { schema, generateId } from "@hark-protocol/db";
import {
  isSameOrDescendant,
  OPPORTUNITY_TTL_SECONDS,
  type Assurance,
  type Campaign,
  type HarkOpportunity,
} from "@hark-protocol/protocol";
import { config } from "../config.js";
import { getCampaignOrThrow } from "./campaign-service.js";

type IntentRow = typeof schema.intents.$inferSelect;
type PlacementRow = typeof schema.placements.$inferSelect;
type PublisherRow = typeof schema.publishers.$inferSelect;
type OpportunityRow = typeof schema.opportunities.$inferSelect;

async function findActiveIntents(db: HarkDatabase, now: Date): Promise<IntentRow[]> {
  return db.query.intents.findMany({
    where: and(isNull(schema.intents.revokedAt), gt(schema.intents.expiresAt, now)),
  });
}

async function getActivePlacementsForIntent(
  db: HarkDatabase,
  intentId: string,
): Promise<PlacementRow[]> {
  const links = await db.query.intentPlacements.findMany({
    where: eq(schema.intentPlacements.intentId, intentId),
  });
  if (links.length === 0) return [];
  const placementIds = links.map((link) => link.placementId);
  const placements = await db.query.placements.findMany({
    where: (fields, { inArray }) => inArray(fields.id, placementIds),
  });
  return placements.filter((placement) => placement.active);
}

function topicsOverlap(intentTopicIds: string[], campaignTopicIds: string[]): boolean {
  return intentTopicIds.some((intentTopic) =>
    campaignTopicIds.some(
      (campaignTopic) =>
        isSameOrDescendant(intentTopic, campaignTopic) || isSameOrDescendant(campaignTopic, intentTopic),
    ),
  );
}

async function getOrCreateOpportunity(
  db: HarkDatabase,
  intentId: string,
  placementId: string,
  now: Date,
): Promise<OpportunityRow> {
  const existing = await db.query.opportunities.findFirst({
    where: and(
      eq(schema.opportunities.intentId, intentId),
      eq(schema.opportunities.placementId, placementId),
      isNull(schema.opportunities.consumedAt),
      gt(schema.opportunities.expiresAt, now),
    ),
  });
  if (existing) return existing;

  const [created] = await db
    .insert(schema.opportunities)
    .values({
      id: generateId("opportunity"),
      intentId,
      placementId,
      expiresAt: new Date(now.getTime() + OPPORTUNITY_TTL_SECONDS * 1000),
    })
    .returning();
  return created!;
}

async function serializeOpportunity(
  db: HarkDatabase,
  opportunity: OpportunityRow,
  intent: IntentRow,
  placement: PlacementRow,
  publisher: PublisherRow,
): Promise<HarkOpportunity> {
  const topics = await db.query.intentTopics.findMany({
    where: eq(schema.intentTopics.intentId, intent.id),
  });

  return {
    id: opportunity.id,
    publisher: {
      id: publisher.id,
      name: publisher.name,
      domain: publisher.domain ?? undefined,
    },
    placement: {
      id: placement.id,
      name: placement.name,
      format: placement.format,
    },
    intent: {
      topics: topics.map((topic) => ({ id: topic.topicId, confidence: topic.confidence ?? undefined })),
      semanticSummary: intent.semanticSummary ?? undefined,
      assurances: (intent.assurancesJson as Assurance[] | null) ?? undefined,
      expiresAt: intent.expiresAt.toISOString(),
    },
    pricing: {
      network: "hedera:testnet",
      asset: "0.0.0",
      amountTinybar: config.reachPriceTinybar,
    },
    expiresAt: opportunity.expiresAt.toISOString(),
  };
}

export async function listOpportunities(
  db: HarkDatabase,
  campaignId?: string,
): Promise<HarkOpportunity[]> {
  let campaign: Campaign | undefined;
  if (campaignId) {
    campaign = await getCampaignOrThrow(db, campaignId);
  }

  const now = new Date();
  const activeIntents = await findActiveIntents(db, now);

  const opportunities: HarkOpportunity[] = [];

  for (const intent of activeIntents) {
    const placements = await getActivePlacementsForIntent(db, intent.id);
    if (placements.length === 0) continue;

    if (campaign) {
      const intentTopics = await db.query.intentTopics.findMany({
        where: eq(schema.intentTopics.intentId, intent.id),
      });
      const intentTopicIds = intentTopics.map((topic) => topic.topicId);
      if (!topicsOverlap(intentTopicIds, campaign.targetTopics)) continue;
    }

    for (const placement of placements) {
      const publisher = await db.query.publishers.findFirst({
        where: eq(schema.publishers.id, placement.publisherId),
      });
      if (!publisher || !publisher.active) continue;

      const opportunity = await getOrCreateOpportunity(db, intent.id, placement.id, now);
      opportunities.push(await serializeOpportunity(db, opportunity, intent, placement, publisher));
    }
  }

  return opportunities;
}
