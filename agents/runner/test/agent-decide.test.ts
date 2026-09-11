import { describe, expect, it } from "vitest";
import type { HarkOpportunity } from "@hark-protocol/protocol";
import { AdvertiserAgent } from "../src/agent.js";
import type { AgentCampaign, RelevanceDecision, RelevanceScorer } from "../src/relevance/scorer.js";

const campaign: AgentCampaign = {
  name: "NovaBook Air",
  productSummary: "Lightweight laptop.",
  targetTopics: ["electronics.computer.laptop"],
  minRelevance: 0.8,
  maxPriceTinybar: "150000",
};

const opportunity: HarkOpportunity = {
  id: "opp_test",
  publisher: { id: "pub_test", name: "Demo Publisher" },
  placement: { id: "plc_test", name: "Home Feed", format: "card" },
  intent: { topics: [{ id: "electronics.computer.laptop" }], expiresAt: new Date().toISOString() },
  pricing: { network: "hedera:testnet", asset: "0.0.0", amountTinybar: "100000" },
  expiresAt: new Date().toISOString(),
};

const noopScorer: RelevanceScorer = { score: async () => ({ relevance: 1, shouldAdvertise: true, reason: "" }) };
const noopFetch = (async () => new Response("{}")) as unknown as typeof fetch;

function buildAgent(runBudgetTinybar = "1000000") {
  return new AdvertiserAgent(
    { harkApiUrl: "http://localhost:4021", campaignId: "cmp_test", campaign, runBudgetTinybar },
    noopScorer,
    noopFetch,
  );
}

function decision(overrides: Partial<RelevanceDecision> = {}): RelevanceDecision {
  return { relevance: 0.9, shouldAdvertise: true, reason: "test", ...overrides };
}

describe("AdvertiserAgent.decide", () => {
  it("approves when the LLM says yes, relevance clears the bar, and budget allows it", () => {
    expect(buildAgent().decide(opportunity, decision())).toBe(true);
  });

  it("rejects when the scorer itself says not to advertise", () => {
    expect(buildAgent().decide(opportunity, decision({ shouldAdvertise: false }))).toBe(false);
  });

  it("rejects when relevance is below the campaign's minRelevance, even if the scorer says yes", () => {
    expect(buildAgent().decide(opportunity, decision({ relevance: 0.5 }))).toBe(false);
  });

  it("rejects when the opportunity price exceeds the campaign's max price", () => {
    const expensiveOpportunity: HarkOpportunity = {
      ...opportunity,
      pricing: { ...opportunity.pricing, amountTinybar: "200000" },
    };
    expect(buildAgent().decide(expensiveOpportunity, decision())).toBe(false);
  });

  it("rejects when the agent's own run budget is exhausted", () => {
    expect(buildAgent("50000").decide(opportunity, decision())).toBe(false);
  });
});
