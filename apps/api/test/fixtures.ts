import type { HarkDatabase } from "@hark-protocol/db";
import { schema, generateId, hashSecret } from "@hark-protocol/db";

export async function createTestPublisher(
  db: HarkDatabase,
  overrides: { slug?: string; secret?: string } = {},
) {
  const secret = overrides.secret ?? "test-secret";
  const apiKeyHash = await hashSecret(secret);
  const [publisher] = await db
    .insert(schema.publishers)
    .values({
      id: generateId("publisher"),
      slug: overrides.slug ?? `test-publisher-${generateId("publisher")}`,
      name: "Test Publisher",
      apiKeyHash,
      active: true,
    })
    .returning();
  return { publisher: publisher!, secret };
}

export async function createTestPlacement(db: HarkDatabase, publisherId: string) {
  const [placement] = await db
    .insert(schema.placements)
    .values({
      id: generateId("placement"),
      publisherId,
      slug: "home-feed",
      name: "Home Feed",
      format: "card",
      active: true,
    })
    .returning();
  return placement!;
}

export async function createTestIntent(
  db: HarkDatabase,
  publisherId: string,
  overrides: { subjectRef?: string; expiresAt?: Date; revokedAt?: Date | null } = {},
) {
  const [intent] = await db
    .insert(schema.intents)
    .values({
      id: generateId("intent"),
      publisherId,
      subjectRef: overrides.subjectRef ?? "alex",
      createdAt: new Date(),
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 60_000),
      revokedAt: overrides.revokedAt ?? null,
    })
    .returning();
  return intent!;
}

export async function createTestOpportunity(
  db: HarkDatabase,
  intentId: string,
  placementId: string,
  overrides: { expiresAt?: Date; consumedAt?: Date | null } = {},
) {
  const [opportunity] = await db
    .insert(schema.opportunities)
    .values({
      id: generateId("opportunity"),
      intentId,
      placementId,
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 60_000),
      consumedAt: overrides.consumedAt ?? null,
    })
    .returning();
  return opportunity!;
}

export async function createTestCampaign(
  db: HarkDatabase,
  overrides: {
    maxPriceTinybar?: string;
    totalBudgetTinybar?: string;
    spentTinybar?: string;
    active?: boolean;
  } = {},
) {
  const [agent] = await db
    .insert(schema.advertiserAgents)
    .values({
      id: generateId("agent"),
      slug: `agent-${generateId("agent")}`,
      displayName: "Test Agent",
    })
    .returning();

  const [campaign] = await db
    .insert(schema.campaigns)
    .values({
      id: generateId("campaign"),
      advertiserAgentId: agent!.id,
      name: "Test Campaign",
      productSummary: "Test product",
      minRelevance: 0.7,
      maxPriceTinybar: overrides.maxPriceTinybar ?? "150000",
      totalBudgetTinybar: overrides.totalBudgetTinybar ?? "1000000",
      spentTinybar: overrides.spentTinybar ?? "0",
      creativeJson: {
        headline: "Test",
        body: "Test body",
        ctaLabel: "Go",
        destinationUrl: "https://example.com",
      },
      active: overrides.active ?? true,
    })
    .returning();

  return { agent: agent!, campaign: campaign! };
}
