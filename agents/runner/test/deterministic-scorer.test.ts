import { describe, expect, it } from "vitest";
import type { HarkOpportunity } from "@hark-protocol/protocol";
import { DeterministicScorer } from "../src/relevance/deterministic-scorer.js";
import type { AgentCampaign } from "../src/relevance/scorer.js";

const novabook: AgentCampaign = {
  name: "NovaBook Air",
  productSummary: "Lightweight laptop aimed at students and developers.",
  targetTopics: ["electronics.computer.laptop", "education.student-technology"],
  minRelevance: 0.8,
  maxPriceTinybar: "150000",
};

function opportunityWith(topicIds: string[], semanticSummary?: string): HarkOpportunity {
  return {
    id: "opp_test",
    publisher: { id: "pub_test", name: "Demo Publisher" },
    placement: { id: "plc_test", name: "Home Feed", format: "card" },
    intent: {
      topics: topicIds.map((id) => ({ id })),
      semanticSummary,
      expiresAt: new Date().toISOString(),
    },
    pricing: { network: "hedera:testnet", asset: "0.0.0", amountTinybar: "100000" },
    expiresAt: new Date().toISOString(),
  };
}

describe("DeterministicScorer", () => {
  const scorer = new DeterministicScorer();

  it("scores an exact topic match at full relevance", async () => {
    const decision = await scorer.score(novabook, opportunityWith(["electronics.computer.laptop"]));
    expect(decision.relevance).toBe(1);
    expect(decision.shouldAdvertise).toBe(true);
  });

  it("scores a parent/child topic match above the deny threshold but below exact", async () => {
    const decision = await scorer.score(novabook, opportunityWith(["electronics.computer.desktop"]));
    expect(decision.relevance).toBeGreaterThan(0);
    expect(decision.relevance).toBeLessThan(1);
  });

  it("scores zero relevance and denies when there is no topic overlap at all", async () => {
    const decision = await scorer.score(novabook, opportunityWith(["travel.flight"]));
    expect(decision.relevance).toBe(0);
    expect(decision.shouldAdvertise).toBe(false);
  });

  it("adds a keyword-overlap bonus when the semantic summary echoes the product summary", async () => {
    const withoutSummary = await scorer.score(
      novabook,
      opportunityWith(["electronics.computer.desktop"]),
    );
    const withSummary = await scorer.score(
      novabook,
      opportunityWith(["electronics.computer.desktop"], "Looking for a lightweight laptop for class."),
    );
    expect(withSummary.relevance).toBeGreaterThan(withoutSummary.relevance);
  });
});
