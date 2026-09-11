import { eq } from "drizzle-orm";
import type { HarkDatabase } from "@hark-protocol/db";
import { schema, generateId } from "@hark-protocol/db";
import type { Campaign, Creative, CreateCampaignInput } from "@hark-protocol/protocol";
import { AppError } from "../middleware/error-handler.js";

type CampaignRow = typeof schema.campaigns.$inferSelect;
type CampaignTopicRow = typeof schema.campaignTopics.$inferSelect;
type AdvertiserAgentRow = typeof schema.advertiserAgents.$inferSelect;

function serialize(
  campaign: CampaignRow,
  agent: AdvertiserAgentRow,
  topics: CampaignTopicRow[],
): Campaign {
  return {
    id: campaign.id,
    advertiserAgentId: campaign.advertiserAgentId,
    advertiserName: agent.displayName,
    name: campaign.name,
    productSummary: campaign.productSummary,
    targetTopics: topics.map((topic) => topic.topicId),
    minRelevance: campaign.minRelevance,
    maxPriceTinybar: campaign.maxPriceTinybar,
    totalBudgetTinybar: campaign.totalBudgetTinybar,
    creative: campaign.creativeJson as Creative,
    active: campaign.active,
    startsAt: campaign.startsAt?.toISOString(),
    endsAt: campaign.endsAt?.toISOString(),
    createdAt: campaign.createdAt.toISOString(),
  };
}

async function loadTopics(db: HarkDatabase, campaignId: string): Promise<CampaignTopicRow[]> {
  return db.query.campaignTopics.findMany({
    where: eq(schema.campaignTopics.campaignId, campaignId),
  });
}

export async function createCampaign(
  db: HarkDatabase,
  input: CreateCampaignInput,
): Promise<Campaign> {
  let agent = await db.query.advertiserAgents.findFirst({
    where: eq(schema.advertiserAgents.id, input.advertiserAgentId),
  });

  if (!agent) {
    const [created] = await db
      .insert(schema.advertiserAgents)
      .values({
        id: input.advertiserAgentId,
        slug: input.advertiserAgentId,
        displayName: input.advertiserName,
        active: true,
      })
      .returning();
    agent = created!;
  }

  const campaignId = generateId("campaign");

  await db.transaction(async (tx) => {
    await tx.insert(schema.campaigns).values({
      id: campaignId,
      advertiserAgentId: agent!.id,
      name: input.name,
      productSummary: input.productSummary,
      minRelevance: input.minRelevance,
      maxPriceTinybar: input.maxPriceTinybar,
      totalBudgetTinybar: input.totalBudgetTinybar,
      spentTinybar: "0",
      creativeJson: input.creative,
      active: true,
      startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
      endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
    });

    await tx.insert(schema.campaignTopics).values(
      input.targetTopics.map((topicId) => ({ campaignId, topicId })),
    );
  });

  return getCampaignOrThrow(db, campaignId);
}

export async function getCampaignOrThrow(db: HarkDatabase, campaignId: string): Promise<Campaign> {
  const campaign = await db.query.campaigns.findFirst({
    where: eq(schema.campaigns.id, campaignId),
  });
  if (!campaign) {
    throw new AppError("CAMPAIGN_NOT_FOUND", "Campaign not found");
  }
  const agent = await db.query.advertiserAgents.findFirst({
    where: eq(schema.advertiserAgents.id, campaign.advertiserAgentId),
  });
  const topics = await loadTopics(db, campaignId);
  return serialize(campaign, agent!, topics);
}

export async function listActiveCampaigns(db: HarkDatabase): Promise<Campaign[]> {
  const rows = await db.query.campaigns.findMany({ where: eq(schema.campaigns.active, true) });
  const results: Campaign[] = [];
  for (const row of rows) {
    const agent = await db.query.advertiserAgents.findFirst({
      where: eq(schema.advertiserAgents.id, row.advertiserAgentId),
    });
    if (!agent) continue;
    const topics = await loadTopics(db, row.id);
    results.push(serialize(row, agent, topics));
  }
  return results;
}
