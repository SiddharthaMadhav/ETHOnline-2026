import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { HarkDatabase } from "@hark-protocol/db";
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

describe("intents -> opportunities", () => {
  it("publisher creates an intent and it appears as an anonymous opportunity", async () => {
    const app = createApp(db);
    const { publisher, secret } = await createTestPublisher(db);
    const placement = await createTestPlacement(db, publisher.id);

    const createRes = await request(app)
      .post("/v1/intents")
      .set("Authorization", `Bearer ${secret}`)
      .send({
        subjectRef: "user-demo-001",
        placementIds: [placement.id],
        topics: [{ id: "electronics.computer.laptop", confidence: 0.91 }],
        semanticSummary: "Looking for something lightweight for college coding.",
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.subjectRef).toBe("user-demo-001");

    const opportunitiesRes = await request(app).get("/v1/opportunities");
    expect(opportunitiesRes.status).toBe(200);
    expect(opportunitiesRes.body.items).toHaveLength(1);

    const opportunity = opportunitiesRes.body.items[0];
    expect(opportunity.publisher.id).toBe(publisher.id);
    expect(opportunity.intent.topics[0].id).toBe("electronics.computer.laptop");
    expect(opportunity.intent.semanticSummary).toContain("lightweight");
  });

  it("never exposes subjectRef in the opportunity response", async () => {
    const app = createApp(db);
    const { publisher, secret } = await createTestPublisher(db);
    const placement = await createTestPlacement(db, publisher.id);

    await request(app)
      .post("/v1/intents")
      .set("Authorization", `Bearer ${secret}`)
      .send({
        subjectRef: "super-secret-subject-ref",
        placementIds: [placement.id],
        topics: [{ id: "electronics.computer.laptop" }],
      });

    const opportunitiesRes = await request(app).get("/v1/opportunities");
    const serialized = JSON.stringify(opportunitiesRes.body);
    expect(serialized).not.toContain("super-secret-subject-ref");
    expect(serialized).not.toContain("subjectRef");
  });

  it("stops producing opportunities once the intent is revoked", async () => {
    const app = createApp(db);
    const { publisher, secret } = await createTestPublisher(db);
    const placement = await createTestPlacement(db, publisher.id);

    const createRes = await request(app)
      .post("/v1/intents")
      .set("Authorization", `Bearer ${secret}`)
      .send({
        subjectRef: "user-demo-002",
        placementIds: [placement.id],
        topics: [{ id: "electronics.computer.laptop" }],
      });

    await request(app)
      .delete(`/v1/intents/${createRes.body.id}`)
      .set("Authorization", `Bearer ${secret}`)
      .send({ reason: "user_requested" });

    const opportunitiesRes = await request(app).get("/v1/opportunities");
    expect(opportunitiesRes.body.items).toHaveLength(0);
  });

  it("stops producing opportunities once the intent has expired", async () => {
    const app = createApp(db);
    const { publisher, secret } = await createTestPublisher(db);
    const placement = await createTestPlacement(db, publisher.id);

    const createRes = await request(app)
      .post("/v1/intents")
      .set("Authorization", `Bearer ${secret}`)
      .send({
        subjectRef: "user-demo-003",
        placementIds: [placement.id],
        topics: [{ id: "electronics.computer.laptop" }],
        expiresInSeconds: 1,
      });
    expect(createRes.status).toBe(201);

    await new Promise((resolve) => setTimeout(resolve, 1100));

    const opportunitiesRes = await request(app).get("/v1/opportunities");
    expect(opportunitiesRes.body.items).toHaveLength(0);
  });

  it("rejects a request with an invalid publisher secret", async () => {
    const app = createApp(db);
    const { publisher } = await createTestPublisher(db);
    const placement = await createTestPlacement(db, publisher.id);

    const res = await request(app)
      .post("/v1/intents")
      .set("Authorization", "Bearer wrong-secret")
      .send({
        subjectRef: "user-demo-004",
        placementIds: [placement.id],
        topics: [{ id: "electronics.computer.laptop" }],
      });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED_PUBLISHER");
  });
});
