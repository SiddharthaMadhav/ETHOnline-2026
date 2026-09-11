import { describe, expect, it, vi } from "vitest";
import { HarkPublisherClient } from "../src/publisher.js";

const sampleIntent = {
  id: "int_1",
  publisherId: "pub_1",
  subjectRef: "alex",
  placementIds: ["plc_1"],
  topics: [{ id: "electronics.computer.laptop", confidence: 0.91 }],
  createdAt: "2026-01-01T00:00:00.000Z",
  expiresAt: "2026-01-31T00:00:00.000Z",
};

const sampleDelivery = {
  id: "del_1",
  campaignId: "cmp_1",
  publisherId: "pub_1",
  placementId: "plc_1",
  subjectRef: "alex",
  status: "queued",
  payment: { network: "hedera:testnet", asset: "0.0.0", amountTinybar: "100000" },
  createdAt: "2026-01-01T00:00:00.000Z",
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

describe("HarkPublisherClient", () => {
  it("sends the publisher secret as a Bearer token on every call", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(sampleIntent));
    const client = new HarkPublisherClient({
      baseUrl: "https://hark.test",
      publisherKey: "secret-123",
      fetch: fetchImpl,
    });

    await client.intents.create({
      subjectRef: "alex",
      placementIds: ["plc_1"],
      topics: [{ id: "electronics.computer.laptop", confidence: 0.91 }],
    });

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://hark.test/v1/intents");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer secret-123");
  });

  it("parses the returned intent against the shared protocol schema", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(sampleIntent));
    const client = new HarkPublisherClient({ baseUrl: "https://hark.test", publisherKey: "k", fetch: fetchImpl });

    const intent = await client.intents.create({
      subjectRef: "alex",
      placementIds: ["plc_1"],
      topics: [{ id: "electronics.computer.laptop" }],
    });

    expect(intent.id).toBe("int_1");
  });

  it("defaults revoke's reason to 'other' and includes it in the request body", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(sampleIntent));
    const client = new HarkPublisherClient({ baseUrl: "https://hark.test", publisherKey: "k", fetch: fetchImpl });

    await client.intents.revoke("int_1");

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(init.body as string)).toEqual({ reason: "other" });
  });

  it("never needs to send subjectRef anywhere but feed.get's own path param", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ items: [sampleDelivery] }));
    const client = new HarkPublisherClient({ baseUrl: "https://hark.test", publisherKey: "k", fetch: fetchImpl });

    const items = await client.feed.get("alex");

    expect(fetchImpl.mock.calls[0][0]).toBe("https://hark.test/v1/feed/alex");
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe("del_1");
  });
});
