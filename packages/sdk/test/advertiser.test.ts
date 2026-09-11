import { describe, expect, it, vi } from "vitest";

vi.mock("@x402/core/http", () => ({
  decodePaymentResponseHeader: vi.fn((header: string) => ({ transaction: `decoded:${header}` })),
}));

import { HarkAdvertiserClient } from "../src/advertiser.js";

const sampleOpportunity = {
  id: "opp_1",
  publisher: { id: "pub_1", name: "Demo Publisher" },
  placement: { id: "plc_1", name: "Home Feed", format: "card" },
  intent: {
    topics: [{ id: "electronics.computer.laptop", confidence: 0.91 }],
    expiresAt: "2026-01-31T00:00:00.000Z",
  },
  pricing: { network: "hedera:testnet", asset: "0.0.0", amountTinybar: "100000" },
  expiresAt: "2026-01-01T00:05:00.000Z",
};

const sampleConfirmation = {
  deliveryId: "del_1",
  status: "queued",
  publisher: { id: "pub_1", name: "Demo Publisher" },
  placement: { id: "plc_1", name: "Home Feed" },
  payment: { network: "hedera:testnet", asset: "0.0.0", amountTinybar: "100000" },
};

function jsonResponse(body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("HarkAdvertiserClient", () => {
  it("requires no auth header at all - discovery/opportunities are free (CLAUDE.md section 2.8)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ items: [sampleOpportunity] }));
    const client = new HarkAdvertiserClient({ baseUrl: "https://hark.test", fetch: fetchImpl });

    await client.opportunities.list("cmp_1");

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit | undefined];
    expect(url).toBe("https://hark.test/v1/opportunities?campaignId=cmp_1");
    expect((init?.headers as Record<string, string> | undefined)?.authorization).toBeUndefined();
  });

  it("omits the campaignId query param when not given", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ items: [] }));
    const client = new HarkAdvertiserClient({ baseUrl: "https://hark.test", fetch: fetchImpl });

    await client.opportunities.list();

    expect(fetchImpl.mock.calls[0][0]).toBe("https://hark.test/v1/opportunities");
  });

  it("reach() decodes the transaction id from the payment-response header when present", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(sampleConfirmation, { "payment-response": "encoded-header" }));
    const client = new HarkAdvertiserClient({ baseUrl: "https://hark.test", fetch: fetchImpl });

    const result = await client.reach({ opportunityId: "opp_1", campaignId: "cmp_1" });

    expect(result.transactionId).toBe("decoded:encoded-header");
    expect(result.confirmation.deliveryId).toBe("del_1");
  });

  it("reach() leaves transactionId undefined when no payment-response header is present", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(sampleConfirmation));
    const client = new HarkAdvertiserClient({ baseUrl: "https://hark.test", fetch: fetchImpl });

    const result = await client.reach({ opportunityId: "opp_1", campaignId: "cmp_1" });

    expect(result.transactionId).toBeUndefined();
  });

  it("reach() sends a fresh idempotency key by default", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(sampleConfirmation));
    const client = new HarkAdvertiserClient({ baseUrl: "https://hark.test", fetch: fetchImpl });

    await client.reach({ opportunityId: "opp_1", campaignId: "cmp_1" });

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["x-hark-idempotency-key"]).toMatch(/^[0-9a-f-]{36}$/);
  });
});
