import { eq } from "drizzle-orm";
import { Hbar, TransferTransaction } from "@hiero-ledger/sdk";
import type { HarkDatabase } from "@hark-protocol/db";
import { schema, generateId } from "@hark-protocol/db";
import { tinybarAdd, tinybarLte } from "@hark-protocol/protocol";
import { config } from "../config.js";
import { getOperatorClient } from "../hedera/operator-client.js";

type PaymentRow = typeof schema.payments.$inferSelect;

export type PublisherBalance = {
  publisherId: string;
  unpaidTinybar: string;
  paymentCount: number;
  payoutHederaAccountId?: string;
};

/**
 * Payments that have actually settled on-chain (transactionId present) for
 * this publisher, whose publisher share hasn't been included in a payout run
 * yet. Only settled payments count - a reserved-but-unsettled payment hasn't
 * actually received real money.
 */
async function findUnpaidSettledPayments(db: HarkDatabase, publisherId: string): Promise<PaymentRow[]> {
  const deliveryRows = await db.query.deliveries.findMany({
    where: eq(schema.deliveries.publisherId, publisherId),
  });
  const paymentIds = deliveryRows.map((d) => d.paymentId).filter((id): id is string => id !== null);
  if (paymentIds.length === 0) return [];

  return db.query.payments.findMany({
    where: (fields, { and, inArray, isNull, isNotNull }) =>
      and(inArray(fields.id, paymentIds), isNull(fields.publisherPayoutId), isNotNull(fields.transactionId)),
  });
}

function sumPublisherShare(payments: PaymentRow[]): string {
  return payments.reduce((sum, payment) => tinybarAdd(sum, payment.publisherShareTinybar ?? "0"), "0");
}

export async function getPublisherBalance(db: HarkDatabase, publisherId: string): Promise<PublisherBalance> {
  const publisher = await db.query.publishers.findFirst({ where: eq(schema.publishers.id, publisherId) });
  const unpaidPayments = await findUnpaidSettledPayments(db, publisherId);
  return {
    publisherId,
    unpaidTinybar: sumPublisherShare(unpaidPayments),
    paymentCount: unpaidPayments.length,
    payoutHederaAccountId: publisher?.payoutHederaAccountId ?? undefined,
  };
}

export type PayoutResult =
  | { status: "paid"; payoutId: string; totalTinybar: string; transactionId: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; payoutId: string; totalTinybar: string; error: string };

/**
 * Runs a single batch payout for one publisher: sums its unpaid settled
 * balance, and if it clears the configured minimum, sends one real HBAR
 * transfer from the operator account to the publisher's registered payout
 * account. Never per-reach - see scripts/run-publisher-payouts.ts for the
 * batch entrypoint this is meant to be called from.
 *
 * Payments are only linked to the payout row (marking them "paid") *after* a
 * successful transfer - if the transfer fails, the payout row is marked
 * failed but the underlying payments remain unpaid and eligible for a future
 * retry run, so a Hedera hiccup here can never silently lose track of money
 * owed to a publisher.
 */
export async function runPublisherPayout(db: HarkDatabase, publisherId: string): Promise<PayoutResult> {
  const publisher = await db.query.publishers.findFirst({ where: eq(schema.publishers.id, publisherId) });
  if (!publisher) return { status: "skipped", reason: "Publisher not found" };
  if (!publisher.payoutHederaAccountId) {
    return { status: "skipped", reason: "No payout Hedera account configured for this publisher" };
  }

  const unpaidPayments = await findUnpaidSettledPayments(db, publisherId);
  const totalTinybar = sumPublisherShare(unpaidPayments);

  if (unpaidPayments.length === 0 || !tinybarLte(config.payoutMinTinybar, totalTinybar)) {
    return {
      status: "skipped",
      reason: `Balance ${totalTinybar} tinybar is below the ${config.payoutMinTinybar} tinybar minimum`,
    };
  }

  const client = getOperatorClient();
  if (!client) {
    return { status: "skipped", reason: "Hedera operator client not configured" };
  }

  const payoutId = generateId("payout");
  await db.insert(schema.publisherPayouts).values({
    id: payoutId,
    publisherId,
    totalTinybar,
    status: "pending",
  });

  try {
    const amount = Hbar.fromTinybars(totalTinybar);
    const response = await new TransferTransaction()
      .addHbarTransfer(config.hederaPayToAccountId, amount.negated())
      .addHbarTransfer(publisher.payoutHederaAccountId, amount)
      .execute(client);
    const receipt = await response.getReceipt(client);
    if (receipt.status.toString() !== "SUCCESS") {
      throw new Error(`Transfer transaction status: ${receipt.status.toString()}`);
    }
    const transactionId = response.transactionId.toString();

    await db.transaction(async (tx) => {
      await tx
        .update(schema.publisherPayouts)
        .set({ status: "paid", transactionId, paidAt: new Date() })
        .where(eq(schema.publisherPayouts.id, payoutId));
      for (const payment of unpaidPayments) {
        await tx
          .update(schema.payments)
          .set({ publisherPayoutId: payoutId })
          .where(eq(schema.payments.id, payment.id));
      }
    });

    return { status: "paid", payoutId, totalTinybar, transactionId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db
      .update(schema.publisherPayouts)
      .set({ status: "failed", failureReason: message })
      .where(eq(schema.publisherPayouts.id, payoutId));
    return { status: "failed", payoutId, totalTinybar, error: message };
  }
}
