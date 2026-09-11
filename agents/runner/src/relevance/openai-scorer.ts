import { generateText, Output } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { HarkOpportunity } from "@hark-protocol/protocol";
import { relevanceDecisionSchema, type AgentCampaign, type RelevanceDecision, type RelevanceScorer } from "./scorer.js";

/** CLAUDE.md section 31 - kept compact on purpose. */
const SYSTEM_PROMPT = `You are evaluating whether a commercial advertising campaign is relevant to an anonymous, temporary purchasing-interest signal.

Return a relevance score from 0 to 1 and whether the advertiser should attempt to reach this user.

Use only the supplied commercial intent.
Do not infer sensitive traits.
Do not infer identity.
Do not broaden targeting beyond the supplied intent.`;

function buildPrompt(campaign: AgentCampaign, opportunity: HarkOpportunity): string {
  return JSON.stringify(
    {
      campaign: {
        name: campaign.name,
        productSummary: campaign.productSummary,
        targetTopics: campaign.targetTopics,
        minRelevance: campaign.minRelevance,
      },
      publisher: opportunity.publisher,
      placement: opportunity.placement,
      opportunity: {
        topics: opportunity.intent.topics,
        semanticSummary: opportunity.intent.semanticSummary,
        assurances: opportunity.intent.assurances,
        priceTinybar: opportunity.pricing.amountTinybar,
      },
    },
    null,
    2,
  );
}

export type RelevanceModelCall = (
  campaign: AgentCampaign,
  opportunity: HarkOpportunity,
) => Promise<RelevanceDecision>;

/** The real call - never invoked directly by tests (see openai-scorer.test.ts). */
async function callOpenAiModel(
  campaign: AgentCampaign,
  opportunity: HarkOpportunity,
): Promise<RelevanceDecision> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  const modelId = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const provider = createOpenAI({ apiKey });

  const { output } = await generateText({
    model: provider(modelId),
    system: SYSTEM_PROMPT,
    output: Output.object({ schema: relevanceDecisionSchema }),
    prompt: buildPrompt(campaign, opportunity),
  });

  return relevanceDecisionSchema.parse(output);
}

/**
 * OpenAI-backed scorer (CLAUDE.md section 24). The model call is injectable so
 * tests can exercise the default-deny-on-error path (section 31) without hitting
 * OpenAI or mocking the AI SDK's internal wire protocol.
 */
export class OpenAIRelevanceScorer implements RelevanceScorer {
  constructor(private readonly modelCall: RelevanceModelCall = callOpenAiModel) {}

  async score(campaign: AgentCampaign, opportunity: HarkOpportunity): Promise<RelevanceDecision> {
    try {
      return await this.modelCall(campaign, opportunity);
    } catch (error) {
      console.error(
        "OpenAI relevance scoring failed; defaulting to deny:",
        error instanceof Error ? error.message : error,
      );
      return {
        relevance: 0,
        shouldAdvertise: false,
        reason: "LLM relevance scoring failed - defaulting to deny",
      };
    }
  }
}
