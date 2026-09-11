import { z } from "zod";
import { tinybarAmountSchema } from "./campaign.js";
import { HEDERA_TESTNET_NETWORK, HBAR_ASSET_ID } from "../constants.js";

export const deliveryStatusSchema = z.enum(["queued", "served", "dismissed"]);
export type DeliveryStatus = z.infer<typeof deliveryStatusSchema>;

export const deliveryPaymentSchema = z.object({
  network: z.literal(HEDERA_TESTNET_NETWORK),
  asset: z.literal(HBAR_ASSET_ID),
  amountTinybar: tinybarAmountSchema,
  transactionId: z.string().optional(),
  payerAccountId: z.string().optional(),
});
export type DeliveryPayment = z.infer<typeof deliveryPaymentSchema>;

/**
 * Internal Hark delivery record (CLAUDE.md section 9).
 * `intentId` and `subjectRef` are internal-only and MUST NOT be serialized
 * to advertiser-facing responses.
 */
export const deliverySchema = z.object({
  id: z.string(),
  campaignId: z.string(),
  publisherId: z.string(),
  placementId: z.string(),
  intentId: z.string(),
  subjectRef: z.string(),
  status: deliveryStatusSchema,
  payment: deliveryPaymentSchema,
  createdAt: z.string().datetime(),
  servedAt: z.string().datetime().optional(),
});
export type Delivery = z.infer<typeof deliverySchema>;

/**
 * Publisher-facing delivery view returned from GET /v1/feed/:subjectRef.
 * Excludes internal intentId (publisher already knows its own subjectRef,
 * but the internal Hark intent database id is never exposed).
 */
export const feedDeliverySchema = deliverySchema.omit({ intentId: true });
export type FeedDelivery = z.infer<typeof feedDeliverySchema>;
