import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { HarkDatabase } from "@hark-protocol/db";
import { schema } from "@hark-protocol/db";
import { eq } from "drizzle-orm";
import { getTestDb, truncateAll } from "./db-helper.js";

// Never let this test suite make a real Hedera/HCS call (CLAUDE.md section
// 28: "Never run real/mainnet payments in ordinary test suites" - the same
// principle applies to the HCS audit trail).
const recordReachSettledAudit = vi.fn();
vi.mock("../src/hcs/audit.js", () => ({ recordReachSettledAudit: (...args: unknown[]) => recordReachSettledAudit(...args) }));
import {
  createTestCampaign,
  createTestIntent,
  createTestOpportunity,
  createTestPlacement,
  createTestPublisher,
} from "./fixtures.js";
import { AppError } from "../src/middleware/error-handler.js";
import { finalizeSettledPayment, reserveOpportunityAndCreateDelivery } from "../src/services/payment-service.js";

let db: HarkDatabase;

beforeAll(() => {
  db = getTestDb();
});

beforeEach(async () => {
  await truncateAll(db);
  recordReachSettledAudit.mockClear();
});

afterAll(async () => {
  await db.$client.end();
});

async function seedOpportunity() {
  const { publisher } = await createTestPublisher(db);
  const placement = await createTestPlacement(db, publisher.id);
  const intent = await createTestIntent(db, publisher.id);
  const opportunity = await createTestOpportunity(db, intent.id, placement.id);
  return { publisher, placement, intent, opportunity };
}

describe("reserveOpportunityAndCreateDelivery", () => {
  it("reserves the opportunity, creates a pending payment, and queues a delivery", async () => {
    const { opportunity, publisher, placement } = await seedOpportunity();
    const { campaign } = await createTestCampaign(db);

    const confirmation = await reserveOpportunityAndCreateDelivery(db, {
      opportunityId: opportunity.id,
      campaignId: campaign.id,
      idempotencyKey: "idem-1",
    });

    expect(confirmation.status).toBe("queued");
    expect(confirmation.publisher.id).toBe(publisher.id);
    expect(confirmation.placement.id).toBe(placement.id);
    expect(confirmation.payment.transactionId).toBeUndefined();

    const [updatedOpportunity] = await db
      .select()
      .from(schema.opportunities)
      .where(eq(schema.opportunities.id, opportunity.id));
    expect(updatedOpportunity!.consumedAt).not.toBeNull();

    const [updatedCampaign] = await db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, campaign.id));
    expect(updatedCampaign!.spentTinybar).toBe("100000");
  });

  it("replays the same delivery for a repeated idempotency key without double-spending", async () => {
    const { opportunity } = await seedOpportunity();
    const { campaign } = await createTestCampaign(db);

    const first = await reserveOpportunityAndCreateDelivery(db, {
      opportunityId: opportunity.id,
      campaignId: campaign.id,
      idempotencyKey: "idem-replay",
    });
    const second = await reserveOpportunityAndCreateDelivery(db, {
      opportunityId: opportunity.id,
      campaignId: campaign.id,
      idempotencyKey: "idem-replay",
    });

    expect(second.deliveryId).toBe(first.deliveryId);

    const [updatedCampaign] = await db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, campaign.id));
    expect(updatedCampaign!.spentTinybar).toBe("100000");
  });

  it("rejects a second, differently-keyed attempt on an already-consumed opportunity", async () => {
    const { opportunity } = await seedOpportunity();
    const { campaign } = await createTestCampaign(db);

    await reserveOpportunityAndCreateDelivery(db, {
      opportunityId: opportunity.id,
      campaignId: campaign.id,
      idempotencyKey: "idem-a",
    });

    await expect(
      reserveOpportunityAndCreateDelivery(db, {
        opportunityId: opportunity.id,
        campaignId: campaign.id,
        idempotencyKey: "idem-b",
      }),
    ).rejects.toMatchObject({ code: "OPPORTUNITY_CONSUMED" });
  });

  it("rejects when the campaign budget is exhausted", async () => {
    const { opportunity } = await seedOpportunity();
    const { campaign } = await createTestCampaign(db, { totalBudgetTinybar: "50000" });

    await expect(
      reserveOpportunityAndCreateDelivery(db, {
        opportunityId: opportunity.id,
        campaignId: campaign.id,
        idempotencyKey: "idem-budget",
      }),
    ).rejects.toMatchObject({ code: "BUDGET_EXCEEDED" });
  });

  it("rejects an unknown opportunity", async () => {
    const { campaign } = await createTestCampaign(db);

    await expect(
      reserveOpportunityAndCreateDelivery(db, {
        opportunityId: "opp_does_not_exist",
        campaignId: campaign.id,
        idempotencyKey: "idem-missing",
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe("finalizeSettledPayment", () => {
  it("backfills the transaction id and payer onto the pending payment", async () => {
    const { opportunity } = await seedOpportunity();
    const { campaign } = await createTestCampaign(db);

    await reserveOpportunityAndCreateDelivery(db, {
      opportunityId: opportunity.id,
      campaignId: campaign.id,
      idempotencyKey: "idem-settle",
    });

    await finalizeSettledPayment(db, opportunity.id, {
      transactionId: "0.0.999@1234567890.123456789",
      payerAccountId: "0.0.888",
    });

    const delivery = await db.query.deliveries.findFirst({
      where: eq(schema.deliveries.opportunityId, opportunity.id),
    });
    const payment = await db.query.payments.findFirst({
      where: eq(schema.payments.id, delivery!.paymentId!),
    });
    expect(payment!.transactionId).toBe("0.0.999@1234567890.123456789");
    expect(payment!.payerAccountId).toBe("0.0.888");
  });

  it("does not submit an HCS audit event when the intent has no topics recorded", async () => {
    const { opportunity } = await seedOpportunity();
    const { campaign } = await createTestCampaign(db);
    await reserveOpportunityAndCreateDelivery(db, {
      opportunityId: opportunity.id,
      campaignId: campaign.id,
      idempotencyKey: "idem-no-topic",
    });

    await finalizeSettledPayment(db, opportunity.id, { transactionId: "0.0.1@1.1", payerAccountId: "0.0.2" });

    expect(recordReachSettledAudit).not.toHaveBeenCalled();
  });

  it("submits an HCS audit event (never subjectRef/semanticSummary/PII) once the intent has a topic", async () => {
    const { publisher } = await createTestPublisher(db);
    const placement = await createTestPlacement(db, publisher.id);
    const intent = await createTestIntent(db, publisher.id);
    await db.insert(schema.intentTopics).values({
      intentId: intent.id,
      topicId: "electronics.computer.laptop",
      confidence: 0.9,
    });
    const opportunity = await createTestOpportunity(db, intent.id, placement.id);
    const { campaign } = await createTestCampaign(db);

    await reserveOpportunityAndCreateDelivery(db, {
      opportunityId: opportunity.id,
      campaignId: campaign.id,
      idempotencyKey: "idem-with-topic",
    });

    await finalizeSettledPayment(db, opportunity.id, {
      transactionId: "0.0.999@1234567890.123456789",
      payerAccountId: "0.0.888",
    });

    expect(recordReachSettledAudit).toHaveBeenCalledTimes(1);
    const [payload] = recordReachSettledAudit.mock.calls[0]!;
    expect(payload).toMatchObject({
      agentId: campaign.advertiserAgentId,
      campaignId: campaign.id,
      publisherId: publisher.id,
      topic: "electronics.computer.laptop",
      amountTinybar: "100000",
      transactionId: "0.0.999@1234567890.123456789",
    });
    expect(payload).not.toHaveProperty("subjectRef");
    expect(payload).not.toHaveProperty("semanticSummary");
  });
});
