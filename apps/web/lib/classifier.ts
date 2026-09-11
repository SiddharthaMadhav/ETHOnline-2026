import "server-only";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { generateText, Output } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { containsObviousPii, isValidTopicId, listTopics, SEMANTIC_SUMMARY_MAX_LENGTH } from "@hark-protocol/protocol";

// Self-contained env loading (dotenv.config is idempotent) so this module
// works whether or not hark-client.ts has already loaded the root .env.
const packageDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(packageDir, "..", "..", "..", ".env") });

/**
 * Vague-intent classifier (CLAUDE.md sections 14, 30). Raw free text is used
 * transiently in-process only and never persisted anywhere - there is no
 * database in this app, and only the normalized {topics, semanticSummary}
 * output below is ever sent on to Hark.
 */
export const intentClassificationSchema = z.object({
  topics: z
    .array(z.object({ id: z.string(), confidence: z.number().min(0).max(1) }))
    .min(1)
    .max(3),
  semanticSummary: z.string().max(SEMANTIC_SUMMARY_MAX_LENGTH),
});
export type IntentClassification = z.infer<typeof intentClassificationSchema>;

const SYSTEM_PROMPT = `You classify a person's vague shopping interest into Hark Protocol's canonical topic taxonomy.

Only return topic ids from the supplied list - never invent one.
Return 1-3 topics ordered by confidence (0 to 1).
Write a short, sanitized semantic summary of the commercial intent only.
Never include names, emails, phone numbers, or other personal identifiers in the summary.`;

function buildPrompt(text: string): string {
  const topicIds = listTopics()
    .map((topic) => topic.id)
    .join(", ");
  return `Available topics: ${topicIds}\n\nPerson's stated interest: "${text}"`;
}

async function callOpenAiClassifier(text: string): Promise<IntentClassification> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  const modelId = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const provider = createOpenAI({ apiKey });

  const { output } = await generateText({
    model: provider(modelId),
    system: SYSTEM_PROMPT,
    output: Output.object({ schema: intentClassificationSchema }),
    prompt: buildPrompt(text),
  });

  return intentClassificationSchema.parse(output);
}

/** CLAUDE.md section 14 - used when no OPENAI_API_KEY is configured. */
const KEYWORD_TOPIC_MAP: Array<{ keywords: string[]; topicId: string }> = [
  { keywords: ["laptop", "notebook", "coding", "programming"], topicId: "electronics.computer.laptop" },
  { keywords: ["desktop", "gaming pc", "workstation"], topicId: "electronics.computer.desktop" },
  { keywords: ["phone", "smartphone", "iphone", "android"], topicId: "electronics.phone" },
  { keywords: ["tablet", "ipad"], topicId: "electronics.tablet" },
  { keywords: ["flight", "flights", "airfare", "plane ticket"], topicId: "travel.flight" },
  { keywords: ["hotel", "place to stay"], topicId: "travel.hotel" },
  { keywords: ["vacation", "travel package", "trip"], topicId: "travel.package" },
  { keywords: ["car", "vehicle", "sedan", "suv"], topicId: "automotive.car" },
  { keywords: ["motorcycle", "motorbike"], topicId: "automotive.motorcycle" },
  { keywords: ["insurance"], topicId: "finance.insurance" },
  { keywords: ["credit card"], topicId: "finance.credit-card" },
  { keywords: ["loan", "mortgage"], topicId: "finance.loan" },
  { keywords: ["running", "run", "marathon", "sneakers"], topicId: "sports.running" },
  { keywords: ["cycling", "bicycle", "bike"], topicId: "sports.cycling" },
  { keywords: ["gym", "fitness", "workout"], topicId: "fitness.gym" },
  { keywords: ["furniture", "couch", "sofa", "desk"], topicId: "home.furniture" },
  { keywords: ["renovation", "remodel", "home improvement"], topicId: "home.renovation" },
  { keywords: ["course", "class", "learn online"], topicId: "education.course" },
  { keywords: ["student", "college", "university", "school"], topicId: "education.student-technology" },
];

function classifyDeterministically(text: string): IntentClassification {
  const lower = text.toLowerCase();
  const matches = KEYWORD_TOPIC_MAP.filter((entry) => entry.keywords.some((keyword) => lower.includes(keyword)));

  if (matches.length === 0) {
    return {
      topics: [{ id: "electronics.computer.laptop", confidence: 0.3 }],
      semanticSummary: "General shopping interest - no strong topic match from the fallback classifier.",
    };
  }

  return {
    topics: matches.slice(0, 3).map((match) => ({ id: match.topicId, confidence: 0.6 })),
    semanticSummary: sanitizeSummary(text),
  };
}

function sanitizeSummary(text: string): string {
  const trimmed = text.slice(0, SEMANTIC_SUMMARY_MAX_LENGTH);
  return containsObviousPii(trimmed) ? "Shopping interest described in a conversation with the platform." : trimmed;
}

/**
 * Classifies free-text vague interest into normalized topics + a sanitized
 * summary. Falls back to the deterministic mapper when no OpenAI key is
 * configured, when the model call fails, or when the model hallucinates
 * topic ids outside the taxonomy for every returned entry.
 */
export async function classifyIntent(text: string): Promise<IntentClassification> {
  if (!process.env.OPENAI_API_KEY) {
    return classifyDeterministically(text);
  }

  try {
    const result = await callOpenAiClassifier(text);
    const validTopics = result.topics.filter((topic) => isValidTopicId(topic.id));
    if (validTopics.length === 0) {
      return classifyDeterministically(text);
    }
    return {
      topics: validTopics,
      semanticSummary: sanitizeSummary(result.semanticSummary),
    };
  } catch (error) {
    console.error("Intent classification failed; using deterministic fallback:", error instanceof Error ? error.message : error);
    return classifyDeterministically(text);
  }
}

/** A directly-selected topic chip skips the LLM entirely. */
export function classifyFromTopicChip(topicId: string, label: string): IntentClassification {
  return {
    topics: [{ id: topicId, confidence: 1 }],
    semanticSummary: `Selected "${label}" directly.`,
  };
}
