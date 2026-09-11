import { and, eq } from "drizzle-orm";
import type { HarkDatabase } from "@hark-protocol/db";
import { schema } from "@hark-protocol/db";
import type { FeedDelivery } from "@hark-protocol/protocol";
import { AppError } from "../middleware/error-handler.js";
import { recordDemoEvent } from "./demo-event-service.js";

type DeliveryRow = typeof schema.deliveries.$inferSelect;
type PaymentRow = typeof schema.payments.$inferSelect;

function serialize(delivery: DeliveryRow, payment: PaymentRow | undefined): FeedDelivery {
  return {
    id: delivery.id,
    campaignId: delivery.campaignId,
    publisherId: delivery.publisherId,
    placementId: delivery.placementId,
    subjectRef: delivery.subjectRef,
    status: delivery.status,
    payment: {
      network: "hedera:testnet",
      asset: "0.0.0",
      amountTinybar: payment?.amountTinybar ?? "0",
      transactionId: payment?.transactionId ?? undefined,
      payerAccountId: payment?.payerAccountId ?? undefined,
    },
    createdAt: delivery.createdAt.toISOString(),
    servedAt: delivery.servedAt?.toISOString(),
  };
}

async function loadPayment(db: HarkDatabase, paymentId: string | null): Promise<PaymentRow | undefined> {
  if (!paymentId) return undefined;
  return db.query.payments.findFirst({ where: eq(schema.payments.id, paymentId) });
}

export async function listFeedForSubject(
  db: HarkDatabase,
  publisherId: string,
  subjectRef: string,
): Promise<FeedDelivery[]> {
  const rows = await db.query.deliveries.findMany({
    where: and(
      eq(schema.deliveries.publisherId, publisherId),
      eq(schema.deliveries.subjectRef, subjectRef),
    ),
  });
  return Promise.all(rows.map(async (row) => serialize(row, await loadPayment(db, row.paymentId))));
}

export async function markDeliveryServed(
  db: HarkDatabase,
  publisherId: string,
  deliveryId: string,
): Promise<FeedDelivery> {
  const existing = await db.query.deliveries.findFirst({
    where: eq(schema.deliveries.id, deliveryId),
  });
  if (!existing || existing.publisherId !== publisherId) {
    throw new AppError("DELIVERY_NOT_FOUND", "Delivery not found");
  }

  const [updated] = await db
    .update(schema.deliveries)
    .set({ status: "served", servedAt: new Date() })
    .where(eq(schema.deliveries.id, deliveryId))
    .returning();

  await recordDemoEvent(db, "delivery.served", publisherId, { deliveryId });
  return serialize(updated!, await loadPayment(db, updated!.paymentId));
}
