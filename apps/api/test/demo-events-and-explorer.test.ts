import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { HarkDatabase } from "@hark-protocol/db";
import { createApp } from "../src/app.js";
import { getTestDb, truncateAll } from "./db-helper.js";
import { createTestCampaign, createTestIntent, createTestOpportunity, createTestPlacement, createTestPublisher } from "./fixtures.js";
import { schema, generateId } from "@hark-protocol/db";

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

describe("POST /v1/demo-events", () => {
  it("accepts a known agent-originated event type", async () => {
    const app = createApp(db);
    const res = await request(app)
      .post("/v1/demo-events")
      .send({ type: "agent.relevance_scored", actor: "novabook", data: { relevance: 0.9 } });

    expect(res.status).toBe(201);
    expect(res.body.type).toBe("agent.relevance_scored");
    expect(res.body.actor).toBe("novabook");

    const listRes = await request(app).get("/v1/demo-events");
    expect(listRes.body.items[0].type).toBe("agent.relevance_scored");
  });

  it("rejects an unknown event type", async () => {
    const app = createApp(db);
    const res = await request(app)
      .post("/v1/demo-events")
      .send({ type: "not.a.real.type", actor: "novabook" });

    expect(res.status).toBe(400);
  });
});

describe("GET /v1/campaigns", () => {
  it("lists active campaigns with their target topics", async () => {
    const app = createApp(db);
    const { campaign } = await createTestCampaign(db, { maxPriceTinybar: "150000" });

    const res = await request(app).get("/v1/campaigns");
    expect(res.status).toBe(200);
    expect(res.body.items.some((item: { id: string }) => item.id === campaign.id)).toBe(true);
  });
});

describe("GET /v1/explorer/summary", () => {
  it("never includes subjectRef anywhere in the response", async () => {
    const app = createApp(db);
    const { publisher } = await createTestPublisher(db);
    const placement = await createTestPlacement(db, publisher.id);
    const intent = await createTestIntent(db, publisher.id, { subjectRef: "super-secret-subject" });
    await db.insert(schema.intentTopics).values({ intentId: intent.id, topicId: "electronics.computer.laptop" });
    await createTestOpportunity(db, intent.id, placement.id);
    const { campaign } = await createTestCampaign(db);

    // Seed a delivery directly (bypassing payment) to exercise recentDeliveries.
    const opportunityForDelivery = await createTestOpportunity(db, intent.id, placement.id);
    const [payment] = await db
      .insert(schema.payments)
      .values({
        id: generateId("payment"),
        idempotencyKey: generateId("payment"),
        network: "hedera:testnet",
        asset: "0.0.0",
        amountTinybar: "100000",
        transactionId: "0.0.999@1111.2222",
      })
      .returning();
    await db.insert(schema.deliveries).values({
      id: generateId("delivery"),
      opportunityId: opportunityForDelivery.id,
      intentId: intent.id,
      campaignId: campaign.id,
      publisherId: publisher.id,
      placementId: placement.id,
      subjectRef: "super-secret-subject",
      status: "queued",
      paymentId: payment!.id,
    });

    const res = await request(app).get("/v1/explorer/summary");
    expect(res.status).toBe(200);

    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain("super-secret-subject");
    expect(serialized).not.toContain("subjectRef");
    expect(serialized).not.toContain(intent.id);

    expect(res.body.publishers.some((p: { id: string }) => p.id === publisher.id)).toBe(true);
    expect(res.body.campaigns.some((c: { id: string }) => c.id === campaign.id)).toBe(true);
    expect(res.body.activeIntentTopicCounts).toEqual(
      expect.arrayContaining([expect.objectContaining({ topicId: "electronics.computer.laptop" })]),
    );
    expect(res.body.recentDeliveries[0].payment.transactionId).toBe("0.0.999@1111.2222");
  });
});
