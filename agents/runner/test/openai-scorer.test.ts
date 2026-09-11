import { describe, expect, it } from "vitest";
import type { HarkOpportunity } from "@hark-protocol/protocol";
import { OpenAIRelevanceScorer } from "../src/relevance/openai-scorer.js";
import type { AgentCampaign } from "../src/relevance/scorer.js";

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

describe("OpenAIRelevanceScorer", () => {
  it("returns the model's decision on a successful call", async () => {
    const scorer = new OpenAIRelevanceScorer(async () => ({
      relevance: 0.94,
      shouldAdvertise: true,
      reason: "Strong topic match",
    }));

    const decision = await scorer.score(campaign, opportunity);
    expect(decision).toEqual({ relevance: 0.94, shouldAdvertise: true, reason: "Strong topic match" });
  });

  it("defaults to deny when the model call throws (CLAUDE.md section 31)", async () => {
    const scorer = new OpenAIRelevanceScorer(async () => {
      throw new Error("network error");
    });

    const decision = await scorer.score(campaign, opportunity);
    expect(decision.relevance).toBe(0);
    expect(decision.shouldAdvertise).toBe(false);
  });

  it("defaults to deny when the model call rejects with a non-Error value", async () => {
    const scorer = new OpenAIRelevanceScorer(async () => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw "malformed output";
    });

    const decision = await scorer.score(campaign, opportunity);
    expect(decision.relevance).toBe(0);
    expect(decision.shouldAdvertise).toBe(false);
  });
});
