import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import request from "supertest";
import type { HarkDatabase } from "@hark-protocol/db";
import { decodePaymentRequiredHeader } from "@x402/core/http";
import { getTestDb } from "./db-helper.js";

/**
 * A tiny stand-in for Blocky402's /supported endpoint. The x402 middleware
 * only calls this lazily on the first real request to POST /v1/reach (see
 * apps/api/src/x402/payment-middleware.ts) - it never touches it for other
 * routes - so every other integration test is unaffected by this file.
 */
let mockFacilitator: http.Server;
let db: HarkDatabase;

beforeAll(async () => {
  mockFacilitator = http.createServer((req, res) => {
    if (req.url === "/supported") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          kinds: [{ x402Version: 2, scheme: "exact", network: "hedera:testnet" }],
          extensions: [],
        }),
      );
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((resolve) => mockFacilitator.listen(0, resolve));
  const { port } = mockFacilitator.address() as AddressInfo;

  // Must be set before src/config.js (and anything importing it) is first
  // evaluated in this file's module graph - see the dynamic import below.
  process.env.BLOCKY402_FACILITATOR_URL = `http://127.0.0.1:${port}`;
  process.env.HEDERA_PAY_TO_ACCOUNT_ID = "0.0.999999";

  db = getTestDb();
});

afterAll(async () => {
  await db.$client.end();
  await new Promise<void>((resolve) => mockFacilitator.close(() => resolve()));
});

describe("POST /v1/reach without a payment header", () => {
  it("returns x402's own 402 payment-required response, not Hark's error JSON", async () => {
    const { createApp } = await import("../src/app.js");
    const app = createApp(db);

    const res = await request(app)
      .post("/v1/reach")
      .send({ opportunityId: "opp_does_not_matter", campaignId: "cmp_does_not_matter" });

    expect(res.status).toBe(402);
    expect(res.body).not.toHaveProperty("error");

    // The x402 v2 wire protocol carries the actual PaymentRequired payload
    // base64-encoded in this response header, not the (empty) JSON body -
    // confirmed by inspecting a real response, not assumed from pseudocode.
    const paymentRequiredHeader = res.headers["payment-required"];
    expect(paymentRequiredHeader).toBeDefined();
    const paymentRequired = decodePaymentRequiredHeader(paymentRequiredHeader);
    expect(Array.isArray(paymentRequired.accepts)).toBe(true);
    expect(paymentRequired.accepts[0]).toMatchObject({
      scheme: "exact",
      network: "hedera:testnet",
      asset: "0.0.0",
      amount: "100000",
    });
  });
});
