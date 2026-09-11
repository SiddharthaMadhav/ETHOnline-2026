import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { HarkDatabase } from "@hark-protocol/db";
import { schema, generateId } from "@hark-protocol/db";
import { createApp } from "../src/app.js";
import { getTestDb, truncateAll } from "./db-helper.js";
import { createTestPlacement, createTestPublisher } from "./fixtures.js";

let db: HarkDatabase;

beforeAll(() => {
  db = getTestDb();
});

beforeEach(async () => {
  await truncateAll(db);
});

afterAll(async () => {
  await db.$client.end();
});

async function seedQueuedDelivery(publisherId: string, placementId: string, subjectRef: string) {
  const intentId = generateId("intent");
  await db.insert(schema.intents).values({
    id: intentId,
    publisherId,
    subjectRef,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
  });

  const opportunityId = generateId("opportunity");
  await db.insert(schema.opportunities).values({
    id: opportunityId,
    intentId,
    placementId,
    expiresAt: new Date(Date.now() + 60_000),
  });

  const [agent] = await db
    .insert(schema.advertiserAgents)
    .values({ id: generateId("agent"), slug: `agent-${generateId("agent")}`, displayName: "Test Agent" })
    .returning();

  const [campaign] = await db
    .insert(schema.campaigns)
    .values({
      id: generateId("campaign"),
      advertiserAgentId: agent!.id,
      name: "Test Campaign",
      productSummary: "Test product",
      minRelevance: 0.7,
      maxPriceTinybar: "150000",
      totalBudgetTinybar: "1000000",
      creativeJson: {
        headline: "Test",
        body: "Test body",
        ctaLabel: "Go",
        destinationUrl: "https://example.com",
      },
    })
    .returning();

  const [payment] = await db
    .insert(schema.payments)
    .values({
      id: generateId("payment"),
      idempotencyKey: generateId("payment"),
      network: "hedera:testnet",
      asset: "0.0.0",
      amountTinybar: "100000",
      transactionId: `0.0.999@${Date.now()}`,
    })
    .returning();

  const [delivery] = await db
    .insert(schema.deliveries)
    .values({
      id: generateId("delivery"),
      opportunityId,
      intentId,
      campaignId: campaign!.id,
      publisherId,
      placementId,
      subjectRef,
      status: "queued",
      paymentId: payment!.id,
    })
    .returning();

  return delivery!;
}

describe("publisher feed access control", () => {
  it("returns a queued delivery for the owning publisher", async () => {
    const app = createApp(db);
    const { publisher, secret } = await createTestPublisher(db);
    const placement = await createTestPlacement(db, publisher.id);
    await seedQueuedDelivery(publisher.id, placement.id, "alex");

    const res = await request(app)
      .get("/v1/feed/alex")
      .set("Authorization", `Bearer ${secret}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].status).toBe("queued");
    expect(res.body.items[0]).not.toHaveProperty("intentId");
  });

  it("does not let a different publisher read another publisher's feed", async () => {
    const app = createApp(db);
    const { publisher: publisherA } = await createTestPublisher(db, { secret: "secret-a" });
    const placementA = await createTestPlacement(db, publisherA.id);
    await seedQueuedDelivery(publisherA.id, placementA.id, "alex");

    const { secret: secretB } = await createTestPublisher(db, { secret: "secret-b" });

    const res = await request(app).get("/v1/feed/alex").set("Authorization", `Bearer ${secretB}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
  });
});
