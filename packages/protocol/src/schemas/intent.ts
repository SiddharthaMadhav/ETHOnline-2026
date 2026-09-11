import { z } from "zod";
import { containsObviousPii } from "../pii.js";
import { assuranceSchema } from "./assurance.js";
import {
  INTENT_DEFAULT_TTL_SECONDS,
  INTENT_MAX_TTL_SECONDS,
  SEMANTIC_SUMMARY_MAX_LENGTH,
} from "../constants.js";
import { isValidTopicId } from "../taxonomy.js";

export const intentTopicSchema = z.object({
  id: z.string().refine(isValidTopicId, { message: "Unknown topic id" }),
  confidence: z.number().min(0).max(1).optional(),
});
export type IntentTopic = z.infer<typeof intentTopicSchema>;

export const semanticSummarySchema = z
  .string()
  .max(SEMANTIC_SUMMARY_MAX_LENGTH)
  .refine((value) => !containsObviousPii(value), {
    message: "Semantic summary appears to contain PII (email or phone number)",
  });

export const revokeReasonSchema = z.enum([
  "fulfilled",
  "user_requested",
  "issuer_invalidated",
  "other",
]);
export type RevokeReason = z.infer<typeof revokeReasonSchema>;

/** Canonical Hark intent object (CLAUDE.md section 9). */
export const harkIntentSchema = z.object({
  id: z.string(),
  publisherId: z.string(),
  // Opaque, publisher-scoped reference. Never returned from advertiser-facing endpoints.
  subjectRef: z.string(),
  placementIds: z.array(z.string()),
  topics: z.array(intentTopicSchema).min(1),
  semanticSummary: semanticSummarySchema.optional(),
  assurances: z.array(assuranceSchema).optional(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  revokedAt: z.string().datetime().nullable().optional(),
  revokeReason: revokeReasonSchema.nullable().optional(),
});
export type HarkIntent = z.infer<typeof harkIntentSchema>;

/** POST /v1/intents request body. */
export const createIntentInputSchema = z.object({
  subjectRef: z.string().min(1),
  placementIds: z.array(z.string()).min(1),
  topics: z.array(intentTopicSchema).min(1),
  semanticSummary: semanticSummarySchema.optional(),
  assurances: z.array(assuranceSchema).optional(),
  expiresInSeconds: z
    .number()
    .int()
    .positive()
    .max(INTENT_MAX_TTL_SECONDS)
    .default(INTENT_DEFAULT_TTL_SECONDS),
});
export type CreateIntentInput = z.infer<typeof createIntentInputSchema>;

/** PATCH /v1/intents/:intentId request body. */
export const updateIntentInputSchema = z.object({
  placementIds: z.array(z.string()).min(1).optional(),
  topics: z.array(intentTopicSchema).min(1).optional(),
  semanticSummary: semanticSummarySchema.nullable().optional(),
  assurances: z.array(assuranceSchema).optional(),
  expiresInSeconds: z.number().int().positive().max(INTENT_MAX_TTL_SECONDS).optional(),
});
export type UpdateIntentInput = z.infer<typeof updateIntentInputSchema>;

/** DELETE /v1/intents/:intentId request body. */
export const revokeIntentInputSchema = z.object({
  reason: revokeReasonSchema.default("other"),
});
export type RevokeIntentInput = z.infer<typeof revokeIntentInputSchema>;
