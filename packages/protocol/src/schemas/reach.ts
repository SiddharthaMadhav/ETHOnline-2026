import { z } from "zod";
import { deliveryPaymentSchema, deliveryStatusSchema } from "./delivery.js";

/**
 * POST /v1/reach request body (CLAUDE.md section 12).
 */
export const reachInputSchema = z.object({
  opportunityId: z.string().min(1),
  campaignId: z.string().min(1),
});
export type ReachInput = z.infer<typeof reachInputSchema>;

/**
 * Advertiser-safe confirmation returned from POST /v1/reach.
 * MUST NOT contain subjectRef, the internal intent id, or any PII.
 */
export const reachConfirmationSchema = z.object({
  deliveryId: z.string(),
  status: deliveryStatusSchema,
  publisher: z.object({
    id: z.string(),
    name: z.string(),
  }),
  placement: z.object({
    id: z.string(),
    name: z.string(),
  }),
  payment: deliveryPaymentSchema,
});
export type ReachConfirmation = z.infer<typeof reachConfirmationSchema>;
