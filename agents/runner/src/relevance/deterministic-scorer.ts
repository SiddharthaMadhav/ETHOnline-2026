import { topicDistance, type HarkOpportunity } from "@hark-protocol/protocol";
import type { AgentCampaign, RelevanceDecision, RelevanceScorer } from "./scorer.js";

const DECISION_THRESHOLD = 0.5;

/**
 * `topicDistance` already returns Infinity for topics with no shared ancestor
 * at all, so it alone is the right overlap test - gating on `isSameOrDescendant`
 * first would wrongly exclude sibling topics (e.g. laptop/desktop, which share
 * the "electronics.computer" ancestor but aren't in an ancestor-descendant
 * relationship with each other).
 */
function bestTopicDistance(campaignTopics: string[], opportunityTopicIds: string[]): number {
  let best = Infinity;
  for (const opportunityTopic of opportunityTopicIds) {
    for (const campaignTopic of campaignTopics) {
      best = Math.min(best, topicDistance(opportunityTopic, campaignTopic));
    }
  }
  return best;
}

/** Very small stopword list so keyword overlap isn't dominated by "the"/"a"/etc. */
const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "for",
  "in",
  "of",
  "on",
  "the",
  "to",
  "with",
]);

function significantWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 2 && !STOPWORDS.has(word)),
  );
}

function keywordOverlapBonus(productSummary: string, semanticSummary: string | undefined): number {
  if (!semanticSummary) return 0;
  const productWords = significantWords(productSummary);
  const summaryWords = significantWords(semanticSummary);
  for (const word of summaryWords) {
    if (productWords.has(word)) return 0.1;
  }
  return 0;
}

/**
 * Rule-based fallback scorer (CLAUDE.md section 32) - used when no OpenAI key is
 * configured. Deliberately simple: exact/parent-child topic match via the shared
 * taxonomy, plus a small keyword-overlap bonus between the campaign's product
 * summary and the opportunity's sanitized semantic summary.
 */
export class DeterministicScorer implements RelevanceScorer {
  async score(campaign: AgentCampaign, opportunity: HarkOpportunity): Promise<RelevanceDecision> {
    const opportunityTopicIds = opportunity.intent.topics.map((topic) => topic.id);
    const distance = bestTopicDistance(campaign.targetTopics, opportunityTopicIds);

    if (!Number.isFinite(distance)) {
      return {
        relevance: 0,
        shouldAdvertise: false,
        reason: "No overlap between campaign target topics and opportunity topics",
      };
    }

    const topicRelevance = 1 / (1 + distance);
    const bonus = keywordOverlapBonus(campaign.productSummary, opportunity.intent.semanticSummary);
    const relevance = Math.min(1, topicRelevance + bonus);

    return {
      relevance,
      shouldAdvertise: relevance >= DECISION_THRESHOLD,
      reason: `Topic distance ${distance} from campaign targets${bonus > 0 ? " plus a keyword overlap bonus" : ""}`,
    };
  }
}
