import type { AgentCampaign } from "../relevance/scorer.js";

/** Mirrors Pace's campaign as seeded in packages/db/src/seed.ts. */
export const paceCampaign: AgentCampaign = {
  name: "Pace Running Gear",
  productSummary: "Running shoes and fitness gear for everyday athletes.",
  targetTopics: ["sports.running", "fitness"],
  minRelevance: 0.75,
  maxPriceTinybar: "150000",
};
