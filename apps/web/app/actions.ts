"use server";

import { INTENT_DEFAULT_TTL_SECONDS, type HarkIntent } from "@hark-protocol/protocol";
import { classifyFromTopicChip, classifyIntent } from "@/lib/classifier";
import { createIntent, markDeliveryServed, revokeIntent, updateIntent } from "@/lib/hark-client";

const DEMO_SUBJECTS = ["alex", "sam", "taylor"] as const;
export type DemoSubject = (typeof DEMO_SUBJECTS)[number];

function assertDemoSubject(subjectRef: string): asserts subjectRef is DemoSubject {
  if (!DEMO_SUBJECTS.includes(subjectRef as DemoSubject)) {
    throw new Error(`Unknown demo subject: ${subjectRef}`);
  }
}

export type CreateIntentFromChipInput = {
  subjectRef: string;
  placementId: string;
  topicId: string;
  topicLabel: string;
};

export async function createIntentFromChipAction(input: CreateIntentFromChipInput): Promise<HarkIntent> {
  assertDemoSubject(input.subjectRef);
  if (!input.placementId) throw new Error("Missing placementId");

  const classification = classifyFromTopicChip(input.topicId, input.topicLabel);
  return createIntent({
    subjectRef: input.subjectRef,
    placementIds: [input.placementId],
    topics: classification.topics,
    semanticSummary: classification.semanticSummary,
    expiresInSeconds: INTENT_DEFAULT_TTL_SECONDS,
  });
}

export type CreateIntentFromTextInput = {
  subjectRef: string;
  placementId: string;
  text: string;
};

export async function createIntentFromTextAction(input: CreateIntentFromTextInput): Promise<HarkIntent> {
  assertDemoSubject(input.subjectRef);
  if (!input.placementId) throw new Error("Missing placementId");
  const text = input.text.trim();
  if (!text) throw new Error("Please describe what you're looking for");
  if (text.length > 500) throw new Error("That's a bit long - try a shorter description");

  const classification = await classifyIntent(text);
  return createIntent({
    subjectRef: input.subjectRef,
    placementIds: [input.placementId],
    topics: classification.topics,
    semanticSummary: classification.semanticSummary,
    expiresInSeconds: INTENT_DEFAULT_TTL_SECONDS,
  });
}

export async function refreshIntentAction(intentId: string): Promise<HarkIntent> {
  return updateIntent(intentId, { expiresInSeconds: INTENT_DEFAULT_TTL_SECONDS });
}

export async function revokeIntentAction(
  intentId: string,
  reason: "fulfilled" | "user_requested",
): Promise<HarkIntent> {
  return revokeIntent(intentId, reason);
}

export async function markDeliveryServedAction(deliveryId: string) {
  return markDeliveryServed(deliveryId);
}
