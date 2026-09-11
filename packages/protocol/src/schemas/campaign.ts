import { z } from "zod";
import { isValidTopicId } from "../taxonomy.js";

export const tinybarAmountSchema = z
  .string()
  .regex(/^\d+$/, "Amount must be a non-negative integer string of tinybar");

export const creativeSchema = z.object({
  headline: z.string().min(1),
  body: z.string().min(1),
  imageUrl: z.string().url().optional(),
  ctaLabel: z.string().min(1),
  destinationUrl: z.string().url(),
});
export type Creative = z.infer<typeof creativeSchema>;

/** Canonical Hark campaign object (CLAUDE.md section 9). */
export const campaignSchema = z.object({
  id: z.string(),
  advertiserAgentId: z.string(),
  advertiserName: z.string(),
  /** CLAUDE.md section 36 (HCS-14 bonus): optional, non-blocking agent identity metadata. */
  advertiserHederaAccountId: z.string().optional(),
  advertiserHcs14Id: z.string().optional(),
  name: z.string(),
  productSummary: z.string(),
  targetTopics: z.array(z.string().refine(isValidTopicId, { message: "Unknown topic id" })).min(1),
  minRelevance: z.number().min(0).max(1),
  maxPriceTinybar: tinybarAmountSchema,
  totalBudgetTinybar: tinybarAmountSchema,
  creative: creativeSchema,
  active: z.boolean(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
});
export type Campaign = z.infer<typeof campaignSchema>;

/** POST /v1/campaigns request body. */
export const createCampaignInputSchema = z.object({
  advertiserAgentId: z.string().min(1),
  advertiserName: z.string().min(1),
  name: z.string().min(1),
  productSummary: z.string().min(1),
  targetTopics: z.array(z.string().refine(isValidTopicId, { message: "Unknown topic id" })).min(1),
  minRelevance: z.number().min(0).max(1).default(0.7),
  maxPriceTinybar: tinybarAmountSchema,
  totalBudgetTinybar: tinybarAmountSchema,
  creative: creativeSchema,
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
});
export type CreateCampaignInput = z.infer<typeof createCampaignInputSchema>;
