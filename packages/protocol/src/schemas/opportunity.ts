import { z } from "zod";
import { assuranceSchema } from "./assurance.js";
import { intentTopicSchema, semanticSummarySchema } from "./intent.js";
import { placementFormatSchema } from "./publisher.js";
import { tinybarAmountSchema } from "./campaign.js";
import { HEDERA_TESTNET_NETWORK, HBAR_ASSET_ID } from "../constants.js";

/**
 * Advertiser-visible anonymous opportunity object (CLAUDE.md section 9).
 * MUST NOT contain subjectRef, internal intent DB id, or any PII.
 */
export const harkOpportunitySchema = z.object({
  id: z.string(),
  publisher: z.object({
    id: z.string(),
    name: z.string(),
    domain: z.string().optional(),
  }),
  placement: z.object({
    id: z.string(),
    name: z.string(),
    format: placementFormatSchema,
  }),
  intent: z.object({
    topics: z.array(intentTopicSchema),
    semanticSummary: semanticSummarySchema.optional(),
    assurances: z.array(assuranceSchema).optional(),
    expiresAt: z.string().datetime(),
  }),
  pricing: z.object({
    network: z.literal(HEDERA_TESTNET_NETWORK),
    asset: z.literal(HBAR_ASSET_ID),
    amountTinybar: tinybarAmountSchema,
  }),
  expiresAt: z.string().datetime(),
});
export type HarkOpportunity = z.infer<typeof harkOpportunitySchema>;
