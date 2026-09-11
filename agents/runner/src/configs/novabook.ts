import type { AgentCampaign } from "../relevance/scorer.js";

/**
 * Mirrors NovaBook's campaign as seeded in packages/db/src/seed.ts.
 * Deliberately not shared code: in reality Hark and an advertiser's own agent
 * are separate parties. AGENT_CAMPAIGN_ID/AGENT_HEDERA_ACCOUNT_ID in .env are
 * what actually join this local view to a real, live campaign + wallet.
 */
export const novabookCampaign: AgentCampaign = {
  name: "NovaBook Air",
  productSummary: "Lightweight laptop aimed at students and developers.",
  targetTopics: ["electronics.computer.laptop", "education.student-technology"],
  minRelevance: 0.8,
  maxPriceTinybar: "150000",
};
