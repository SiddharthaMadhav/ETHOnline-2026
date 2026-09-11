import { and, eq, isNull } from "drizzle-orm";
import type { HarkDatabase } from "@hark-protocol/db";
import { schema, generateId } from "@hark-protocol/db";
import { tinybarAdd, tinybarLte, type ReachConfirmation } from "@hark-protocol/protocol";
import { config } from "../config.js";
import { AppError } from "../middleware/error-handler.js";
import { recordDemoEvent } from "./demo-event-service.js";
import { recordReachSettledAudit } from "../hcs/audit.js";

type DeliveryRow = typeof schema.deliveries.$inferSelect;
type PaymentRow = typeof schema.payments.$inferSelect;

/** Postgres unique_violation SQLSTATE. */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";
}

async function serializeConfirmation(
  db: HarkDatabase,
  delivery: DeliveryRow,
  payment: PaymentRow,
): Promise<ReachConfirmation> {
  const [publisher, placement] = await Promise.all([
    db.query.publishers.findFirst({ where: eq(schema.publishers.id, delivery.publisherId) }),
    db.query.placements.findFirst({ where: eq(schema.placements.id, delivery.placementId) }),
  ]);
  if (!publisher || !placement) {
    throw new AppError("INTERNAL_ERROR", "Delivery references a missing publisher or placement");
  }

  return {
    deliveryId: delivery.id,
    status: delivery.status,
    publisher: { id: publisher.id, name: publisher.name },
    placement: { id: placement.id, name: placement.name },
    payment: {
      network: "hedera:testnet",
      asset: "0.0.0",
      amountTinybar: payment.amountTinybar,
      transactionId: payment.transactionId ?? undefined,
      payerAccountId: payment.payerAccountId ?? undefined,
    },
  };
}

/**
 * Runs inside the x402-verified (but not-yet-settled) POST /v1/reach handler.
 * Validates the opportunity/campaign, reserves the opportunity, and creates the
 * delivery + a pending payment row in one transaction. The payment's
 * transactionId is filled in later by `finalizeSettledPayment`, called from the
 * resource server's `onAfterSettle` hook once the facilitator actually settles -
 * see apps/api/src/x402/resource-server.ts for why that can't happen here.
 */
export async function reserveOpportunityAndCreateDelivery(
  db: HarkDatabase,
  input: { opportunityId: string; campaignId: string; idempotencyKey: string },
): Promise<ReachConfirmation> {
  const existingPayment = await db.query.payments.findFirst({
    where: eq(schema.payments.idempotencyKey, input.idempotencyKey),
  });
  if (existingPayment) {
    const delivery = await db.query.deliveries.findFirst({
      where: eq(schema.deliveries.paymentId, existingPayment.id),
    });
    if (!delivery) {
      throw new AppError("INTERNAL_ERROR", "Payment record exists without a delivery");
    }
    return serializeConfirmation(db, delivery, existingPayment);
  }

  const now = new Date();

  const opportunity = await db.query.opportunities.findFirst({
    where: eq(schema.opportunities.id, input.opportunityId),
  });
  if (!opportunity) {
    throw new AppError("OPPORTUNITY_NOT_FOUND", "Opportunity not found");
  }
  if (opportunity.consumedAt) {
    throw new AppError("OPPORTUNITY_CONSUMED", "Opportunity already consumed");
  }
  if (opportunity.expiresAt.getTime() <= now.getTime()) {
    throw new AppError("OPPORTUNITY_EXPIRED", "Opportunity has expired");
  }

  const intent = await db.query.intents.findFirst({
    where: eq(schema.intents.id, opportunity.intentId),
  });
  if (!intent || intent.revokedAt || intent.expiresAt.getTime() <= now.getTime()) {
    throw new AppError("INTENT_EXPIRED", "The underlying intent is no longer active");
  }

  const campaign = await db.query.campaigns.findFirst({
    where: eq(schema.campaigns.id, input.campaignId),
  });
  if (!campaign) {
    throw new AppError("CAMPAIGN_NOT_FOUND", "Campaign not found");
  }
  if (!campaign.active) {
    throw new AppError("CAMPAIGN_INACTIVE", "Campaign is not active");
  }

  const price = config.reachPriceTinybar;
  if (!tinybarLte(price, campaign.maxPriceTinybar)) {
    throw new AppError("BUDGET_EXCEEDED", "Reach price exceeds the campaign's max price");
  }
  if (!tinybarLte(tinybarAdd(campaign.spentTinybar, price), campaign.totalBudgetTinybar)) {
    throw new AppError("BUDGET_EXCEEDED", "Campaign budget is exhausted");
  }

  const placement = await db.query.placements.findFirst({
    where: eq(schema.placements.id, opportunity.placementId),
  });
  if (!placement) {
    throw new AppError("INTERNAL_ERROR", "Opportunity references a missing placement");
  }

  const paymentId = generateId("payment");
  const deliveryId = generateId("delivery");

  try {
    await db.transaction(async (tx) => {
      const consumed = await tx
        .update(schema.opportunities)
        .set({ consumedAt: now })
        .where(and(eq(schema.opportunities.id, opportunity.id), isNull(schema.opportunities.consumedAt)))
        .returning();
      if (consumed.length === 0) {
        throw new AppError("OPPORTUNITY_CONSUMED", "Opportunity already consumed");
      }

      await tx.insert(schema.payments).values({
        id: paymentId,
        idempotencyKey: input.idempotencyKey,
        network: "hedera:testnet",
        asset: "0.0.0",
        amountTinybar: price,
      });

      await tx.insert(schema.deliveries).values({
        id: deliveryId,
        opportunityId: opportunity.id,
        intentId: intent.id,
        campaignId: campaign.id,
        publisherId: placement.publisherId,
        placementId: placement.id,
        subjectRef: intent.subjectRef,
        status: "queued",
        paymentId,
      });

      await tx
        .update(schema.campaigns)
        .set({ spentTinybar: tinybarAdd(campaign.spentTinybar, price) })
        .where(eq(schema.campaigns.id, campaign.id));
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (isUniqueViolation(error)) {
      // deliveries_intent_campaign_unique: this campaign already reached this intent.
      throw new AppError("OPPORTUNITY_CONSUMED", "This campaign has already reached this intent");
    }
    throw error;
  }

  await recordDemoEvent(db, "reach.payment_verified", campaign.advertiserAgentId, {
    opportunityId: opportunity.id,
    campaignId: campaign.id,
  });
  await recordDemoEvent(db, "delivery.queued", campaign.advertiserAgentId, { deliveryId });

  const [delivery, payment] = await Promise.all([
    db.query.deliveries.findFirst({ where: eq(schema.deliveries.id, deliveryId) }),
    db.query.payments.findFirst({ where: eq(schema.payments.id, paymentId) }),
  ]);
  return serializeConfirmation(db, delivery!, payment!);
}

/**
 * Backfills the real settlement transaction id/payer once the facilitator
 * confirms it, per opportunityId (the only correlator reliably available to
 * both the handler and the resource server's onAfterSettle hook).
 */
export async function finalizeSettledPayment(
  db: HarkDatabase,
  opportunityId: string,
  settlement: { transactionId: string; payerAccountId?: string },
): Promise<void> {
  const delivery = await db.query.deliveries.findFirst({
    where: eq(schema.deliveries.opportunityId, opportunityId),
  });
  if (!delivery || !delivery.paymentId) return;

  await db
    .update(schema.payments)
    .set({ transactionId: settlement.transactionId, payerAccountId: settlement.payerAccountId })
    .where(eq(schema.payments.id, delivery.paymentId));

  await recordDemoEvent(db, "reach.payment_settled", "blocky402-facilitator", {
    deliveryId: delivery.id,
    transactionId: settlement.transactionId,
  });

  // Best-effort HCS audit trail (CLAUDE.md section 35) - never PII, never
  // subjectRef, never blocks/fails the payment flow above.
  const campaign = await db.query.campaigns.findFirst({
    where: eq(schema.campaigns.id, delivery.campaignId),
  });
  const [primaryTopic] = await db.query.intentTopics.findMany({
    where: eq(schema.intentTopics.intentId, delivery.intentId),
  });
  if (campaign && primaryTopic) {
    await recordReachSettledAudit({
      agentId: campaign.advertiserAgentId,
      campaignId: delivery.campaignId,
      publisherId: delivery.publisherId,
      topic: primaryTopic.topicId,
      amountTinybar: config.reachPriceTinybar,
      transactionId: settlement.transactionId,
    });
  }
}
