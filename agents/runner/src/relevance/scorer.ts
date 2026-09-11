import { z } from "zod";
import type { HarkOpportunity } from "@hark-protocol/protocol";

/**
 * A campaign's own view of itself, as known to the advertiser's agent - not the
 * full `Campaign` protocol type (creative, budget spend, etc. aren't needed here).
 */
export type AgentCampaign = {
  name: string;
  productSummary: string;
  targetTopics: string[];
  minRelevance: number;
  maxPriceTinybar: string;
};

/** CLAUDE.md sections 15/16. */
export const relevanceDecisionSchema = z.object({
  relevance: z.number().min(0).max(1),
  shouldAdvertise: z.boolean(),
  reason: z.string(),
});
export type RelevanceDecision = z.infer<typeof relevanceDecisionSchema>;

export interface RelevanceScorer {
  score(campaign: AgentCampaign, opportunity: HarkOpportunity): Promise<RelevanceDecision>;
}
