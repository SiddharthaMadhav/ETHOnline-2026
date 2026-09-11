import type { AgentCampaign } from "../relevance/scorer.js";

/** Mirrors FlyLite's campaign as seeded in packages/db/src/seed.ts. */
export const flyliteCampaign: AgentCampaign = {
  name: "FlyLite Getaways",
  productSummary: "Budget flight and travel package deals.",
  targetTopics: ["travel", "travel.flight", "travel.package"],
  minRelevance: 0.75,
  maxPriceTinybar: "150000",
};
