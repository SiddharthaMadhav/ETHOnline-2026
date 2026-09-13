import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { HarkDatabase } from "@hark-protocol/db";
import { schema, generateId } from "@hark-protocol/db";
import { eq } from "drizzle-orm";
import { getTestDb, truncateAll } from "./db-helper.js";
import {
  createTestCampaign,
  createTestIntent,
  createTestOpportunity,
  createTestPlacement,
  createTestPublisher,
} from "./fixtures.js";

// Never let this test suite make a real Hedera transfer (CLAUDE.md section
// 28's "never run real payments in ordinary test suites" applies to payouts
// exactly as much as to the mandatory reach flow).
const { executeMock } = vi.hoisted(() => ({ executeMock: vi.fn() }));

vi.mock("@hiero-ledger/sdk", () => {
  class FakeHbar {
    constructor(public tinybars: string) {}
    negated() {
      return new FakeHbar((-BigInt(this.tinybars)).toString());
    }
    static fromTinybars(v: string) {
      return new FakeHbar(String(v));
    }
  }
  class FakeTransferTransaction {
    addHbarTransfer() {
      return this;
    }
    execute = executeMock;
  }
  return { Hbar: FakeHbar, TransferTransaction: FakeTransferTransaction };
});

vi.mock("../src/hedera/operator-client.js", () => ({
  getOperatorClient: () => ({}),
}));

const { getPublisherBalance, runPublisherPayout } = await import("../src/services/payout-service.js");

let db: HarkDatabase;

beforeAll(() => {
  db = getTestDb();
});

beforeEach(async () => {
  await truncateAll(db);
  executeMock.mockReset();
  executeMock.mockResolvedValue({
    transactionId: { toString: () => "0.0.999@1111111111.000000001" },
    getReceipt: async () => ({ status: { toString: () => "SUCCESS" } }),
  });
});

afterAll(async () => {
  await db.$client.end();
});

/** Inserts a settled (or unsettled) payment + delivery for a publisher, bypassing the reach flow. */
async function createSettledPayment(
  db: HarkDatabase,
  args: {
    publisherId: string;
    campaignId: string;
    intentId: string;
    placementId: string;
    publisherShareTinybar: string;
    protocolShareTinybar: string;
    settled?: boolean;
    publisherPayoutId?: string | null;
  },
) {
  const opportunity = await createTestOpportunity(db, args.intentId, args.placementId);
  const paymentId = generateId("payment");
  await db.insert(schema.payments).values({
    id: paymentId,
    idempotencyKey: generateId("payment"),
    network: "hedera:testnet",
    asset: "0.0.0",
    amountTinybar: (BigInt(args.publisherShareTinybar) + BigInt(args.protocolShareTinybar)).toString(),
    publisherShareTinybar: args.publisherShareTinybar,
    protocolShareTinybar: args.protocolShareTinybar,
    transactionId: args.settled === false ? null : `0.0.1@${Date.now()}.${paymentId.length}`,
    publisherPayoutId: args.publisherPayoutId ?? null,
  });
  await db.insert(schema.deliveries).values({
    id: generateId("delivery"),
    opportunityId: opportunity.id,
    intentId: args.intentId,
    campaignId: args.campaignId,
    publisherId: args.publisherId,
    placementId: args.placementId,
    subjectRef: "alex",
    status: "queued",
    paymentId,
  });
  return paymentId;
}

describe("getPublisherBalance", () => {
  it("sums only settled, not-yet-paid-out publisher shares", async () => {
    const { publisher } = await createTestPublisher(db);
    const placement = await createTestPlacement(db, publisher.id);
    const intentA = await createTestIntent(db, publisher.id);
    const intentB = await createTestIntent(db, publisher.id);
    const { campaign } = await createTestCampaign(db);

    await createSettledPayment(db, {
      publisherId: publisher.id,
      campaignId: campaign.id,
      intentId: intentA.id,
      placementId: placement.id,
      publisherShareTinybar: "80000",
      protocolShareTinybar: "20000",
    });
    await createSettledPayment(db, {
      publisherId: publisher.id,
      campaignId: campaign.id,
      intentId: intentB.id,
      placementId: placement.id,
      publisherShareTinybar: "40000",
      protocolShareTinybar: "10000",
    });

    const balance = await getPublisherBalance(db, publisher.id);
    expect(balance.unpaidTinybar).toBe("120000");
    expect(balance.paymentCount).toBe(2);
  });

  it("excludes payments that haven't settled yet (no transactionId)", async () => {
    const { publisher } = await createTestPublisher(db);
    const placement = await createTestPlacement(db, publisher.id);
    const intent = await createTestIntent(db, publisher.id);
    const { campaign } = await createTestCampaign(db);

    await createSettledPayment(db, {
      publisherId: publisher.id,
      campaignId: campaign.id,
      intentId: intent.id,
      placementId: placement.id,
      publisherShareTinybar: "80000",
      protocolShareTinybar: "20000",
      settled: false,
    });

    const balance = await getPublisherBalance(db, publisher.id);
    expect(balance.unpaidTinybar).toBe("0");
    expect(balance.paymentCount).toBe(0);
  });

  it("excludes payments already included in a prior payout", async () => {
    const { publisher } = await createTestPublisher(db);
    const placement = await createTestPlacement(db, publisher.id);
    const intent = await createTestIntent(db, publisher.id);
    const { campaign } = await createTestCampaign(db);

    const [priorPayout] = await db
      .insert(schema.publisherPayouts)
      .values({ id: generateId("payout"), publisherId: publisher.id, totalTinybar: "80000", status: "paid" })
      .returning();

    await createSettledPayment(db, {
      publisherId: publisher.id,
      campaignId: campaign.id,
      intentId: intent.id,
      placementId: placement.id,
      publisherShareTinybar: "80000",
      protocolShareTinybar: "20000",
      publisherPayoutId: priorPayout!.id,
    });

    const balance = await getPublisherBalance(db, publisher.id);
    expect(balance.unpaidTinybar).toBe("0");
  });

  it("never counts another publisher's payments", async () => {
    const { publisher: publisherA } = await createTestPublisher(db);
    const { publisher: publisherB } = await createTestPublisher(db);
    const placementA = await createTestPlacement(db, publisherA.id);
    const intentA = await createTestIntent(db, publisherA.id);
    const { campaign } = await createTestCampaign(db);

    await createSettledPayment(db, {
      publisherId: publisherA.id,
      campaignId: campaign.id,
      intentId: intentA.id,
      placementId: placementA.id,
      publisherShareTinybar: "80000",
      protocolShareTinybar: "20000",
    });

    const balanceB = await getPublisherBalance(db, publisherB.id);
    expect(balanceB.unpaidTinybar).toBe("0");
  });
});

describe("runPublisherPayout", () => {
  async function seedPublisherWithBalance(shareTinybar: string, payoutAccountId = "0.0.55555") {
    const { publisher } = await createTestPublisher(db, { payoutHederaAccountId: payoutAccountId });
    const placement = await createTestPlacement(db, publisher.id);
    const intent = await createTestIntent(db, publisher.id);
    const { campaign } = await createTestCampaign(db);
    const paymentId = await createSettledPayment(db, {
      publisherId: publisher.id,
      campaignId: campaign.id,
      intentId: intent.id,
      placementId: placement.id,
      publisherShareTinybar: shareTinybar,
      protocolShareTinybar: "20000",
    });
    return { publisher, paymentId };
  }

  it("skips a publisher with no payout account configured", async () => {
    const { publisher } = await createTestPublisher(db);
    const result = await runPublisherPayout(db, publisher.id);
    expect(result).toMatchObject({ status: "skipped" });
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("skips when the balance is below the configured minimum", async () => {
    const { publisher } = await seedPublisherWithBalance("100");
    const result = await runPublisherPayout(db, publisher.id);
    expect(result).toMatchObject({ status: "skipped" });
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("pays out and links the settled payments to the payout row on success", async () => {
    const { publisher, paymentId } = await seedPublisherWithBalance("2000000");

    const result = await runPublisherPayout(db, publisher.id);

    expect(result).toMatchObject({
      status: "paid",
      totalTinybar: "2000000",
      transactionId: "0.0.999@1111111111.000000001",
    });
    expect(executeMock).toHaveBeenCalledTimes(1);

    const payment = await db.query.payments.findFirst({ where: eq(schema.payments.id, paymentId) });
    expect(payment!.publisherPayoutId).not.toBeNull();

    if (result.status === "paid") {
      const payout = await db.query.publisherPayouts.findFirst({
        where: eq(schema.publisherPayouts.id, result.payoutId),
      });
      expect(payout).toMatchObject({ status: "paid", totalTinybar: "2000000" });
    }

    const balanceAfter = await getPublisherBalance(db, publisher.id);
    expect(balanceAfter.unpaidTinybar).toBe("0");
  });

  it("marks the payout failed and leaves payments unpaid (for a future retry) when the transfer fails", async () => {
    executeMock.mockRejectedValueOnce(new Error("network down"));
    const { publisher, paymentId } = await seedPublisherWithBalance("2000000");

    const result = await runPublisherPayout(db, publisher.id);

    expect(result).toMatchObject({ status: "failed", error: "network down" });

    const payment = await db.query.payments.findFirst({ where: eq(schema.payments.id, paymentId) });
    expect(payment!.publisherPayoutId).toBeNull();

    if (result.status === "failed") {
      const payout = await db.query.publisherPayouts.findFirst({
        where: eq(schema.publisherPayouts.id, result.payoutId),
      });
      expect(payout).toMatchObject({ status: "failed", failureReason: "network down" });
    }

    // Still owed - eligible for a future retry run.
    const balanceAfter = await getPublisherBalance(db, publisher.id);
    expect(balanceAfter.unpaidTinybar).toBe("2000000");
  });
});
