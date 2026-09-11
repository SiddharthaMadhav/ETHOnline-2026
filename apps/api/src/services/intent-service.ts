import { and, eq } from "drizzle-orm";
import type { HarkDatabase } from "@hark-protocol/db";
import { schema, generateId } from "@hark-protocol/db";
import type {
  Assurance,
  CreateIntentInput,
  HarkIntent,
  UpdateIntentInput,
} from "@hark-protocol/protocol";
import { AppError } from "../middleware/error-handler.js";
import { recordDemoEvent } from "./demo-event-service.js";

type IntentRow = typeof schema.intents.$inferSelect;
type IntentTopicRow = typeof schema.intentTopics.$inferSelect;

function toIso(date: Date | null | undefined): string | undefined {
  return date ? date.toISOString() : undefined;
}

async function loadTopics(db: HarkDatabase, intentId: string): Promise<IntentTopicRow[]> {
  return db.query.intentTopics.findMany({
    where: eq(schema.intentTopics.intentId, intentId),
  });
}

async function loadPlacementIds(db: HarkDatabase, intentId: string): Promise<string[]> {
  const rows = await db.query.intentPlacements.findMany({
    where: eq(schema.intentPlacements.intentId, intentId),
  });
  return rows.map((row) => row.placementId);
}

function serialize(intent: IntentRow, topics: IntentTopicRow[], placementIds: string[]): HarkIntent {
  return {
    id: intent.id,
    publisherId: intent.publisherId,
    subjectRef: intent.subjectRef,
    placementIds,
    topics: topics.map((topic) => ({
      id: topic.topicId,
      confidence: topic.confidence ?? undefined,
    })),
    semanticSummary: intent.semanticSummary ?? undefined,
    assurances: (intent.assurancesJson as Assurance[] | null) ?? undefined,
    createdAt: intent.createdAt.toISOString(),
    expiresAt: intent.expiresAt.toISOString(),
    revokedAt: toIso(intent.revokedAt) ?? null,
    revokeReason: (intent.revokeReason as HarkIntent["revokeReason"]) ?? null,
  };
}

export function isIntentActive(intent: Pick<IntentRow, "expiresAt" | "revokedAt">, now = new Date()): boolean {
  if (intent.revokedAt) return false;
  return intent.expiresAt.getTime() > now.getTime();
}

async function assertPlacementsBelongToPublisher(
  db: HarkDatabase,
  publisherId: string,
  placementIds: string[],
) {
  const rows = await db.query.placements.findMany({
    where: (fields, { inArray }) => inArray(fields.id, placementIds),
  });
  const found = new Set(rows.map((row) => row.id));
  for (const placementId of placementIds) {
    if (!found.has(placementId)) {
      throw new AppError("VALIDATION_ERROR", `Unknown placement id: ${placementId}`);
    }
    const placement = rows.find((row) => row.id === placementId)!;
    if (placement.publisherId !== publisherId || !placement.active) {
      throw new AppError("VALIDATION_ERROR", `Placement not available: ${placementId}`);
    }
  }
}

export async function createIntent(
  db: HarkDatabase,
  publisherId: string,
  input: CreateIntentInput,
): Promise<HarkIntent> {
  await assertPlacementsBelongToPublisher(db, publisherId, input.placementIds);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + input.expiresInSeconds * 1000);
  const intentId = generateId("intent");

  await db.transaction(async (tx) => {
    await tx.insert(schema.intents).values({
      id: intentId,
      publisherId,
      subjectRef: input.subjectRef,
      semanticSummary: input.semanticSummary,
      assurancesJson: input.assurances ?? null,
      createdAt: now,
      expiresAt,
    });

    await tx.insert(schema.intentTopics).values(
      input.topics.map((topic) => ({
        intentId,
        topicId: topic.id,
        confidence: topic.confidence ?? null,
      })),
    );

    await tx.insert(schema.intentPlacements).values(
      input.placementIds.map((placementId) => ({
        intentId,
        placementId,
      })),
    );
  });

  const intent = await getIntentOrThrow(db, publisherId, intentId);
  await recordDemoEvent(db, "intent.created", publisherId, {
    intentId,
    topics: intent.topics.map((topic) => topic.id),
  });
  return intent;
}

async function fetchIntentRow(db: HarkDatabase, intentId: string): Promise<IntentRow | undefined> {
  return db.query.intents.findFirst({ where: eq(schema.intents.id, intentId) });
}

/** Throws INTENT_NOT_FOUND both when missing and when owned by a different publisher. */
export async function getIntentOrThrow(
  db: HarkDatabase,
  publisherId: string,
  intentId: string,
): Promise<HarkIntent> {
  const intent = await fetchIntentRow(db, intentId);
  if (!intent || intent.publisherId !== publisherId) {
    throw new AppError("INTENT_NOT_FOUND", "Intent not found");
  }
  const [topics, placementIds] = await Promise.all([
    loadTopics(db, intentId),
    loadPlacementIds(db, intentId),
  ]);
  return serialize(intent, topics, placementIds);
}

export async function updateIntent(
  db: HarkDatabase,
  publisherId: string,
  intentId: string,
  input: UpdateIntentInput,
): Promise<HarkIntent> {
  const existing = await fetchIntentRow(db, intentId);
  if (!existing || existing.publisherId !== publisherId) {
    throw new AppError("INTENT_NOT_FOUND", "Intent not found");
  }
  if (existing.revokedAt) {
    throw new AppError("INTENT_REVOKED", "Cannot update a revoked intent");
  }

  if (input.placementIds) {
    await assertPlacementsBelongToPublisher(db, publisherId, input.placementIds);
  }

  await db.transaction(async (tx) => {
    const patch: Partial<IntentRow> = {};
    if (input.semanticSummary !== undefined) {
      patch.semanticSummary = input.semanticSummary;
    }
    if (input.expiresInSeconds !== undefined) {
      patch.expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000);
    }
    if (input.assurances !== undefined) {
      patch.assurancesJson = input.assurances;
    }
    if (Object.keys(patch).length > 0) {
      await tx.update(schema.intents).set(patch).where(eq(schema.intents.id, intentId));
    }

    if (input.topics) {
      await tx.delete(schema.intentTopics).where(eq(schema.intentTopics.intentId, intentId));
      await tx.insert(schema.intentTopics).values(
        input.topics.map((topic) => ({
          intentId,
          topicId: topic.id,
          confidence: topic.confidence ?? null,
        })),
      );
    }

    if (input.placementIds) {
      await tx.delete(schema.intentPlacements).where(eq(schema.intentPlacements.intentId, intentId));
      await tx.insert(schema.intentPlacements).values(
        input.placementIds.map((placementId) => ({ intentId, placementId })),
      );
    }
  });

  const updated = await getIntentOrThrow(db, publisherId, intentId);
  await recordDemoEvent(db, "intent.updated", publisherId, { intentId });
  return updated;
}

export async function revokeIntent(
  db: HarkDatabase,
  publisherId: string,
  intentId: string,
  reason: HarkIntent["revokeReason"],
): Promise<HarkIntent> {
  const existing = await fetchIntentRow(db, intentId);
  if (!existing || existing.publisherId !== publisherId) {
    throw new AppError("INTENT_NOT_FOUND", "Intent not found");
  }

  if (!existing.revokedAt) {
    await db
      .update(schema.intents)
      .set({ revokedAt: new Date(), revokeReason: reason ?? "other" })
      .where(and(eq(schema.intents.id, intentId), eq(schema.intents.publisherId, publisherId)));
  }

  const revoked = await getIntentOrThrow(db, publisherId, intentId);
  await recordDemoEvent(db, "intent.revoked", publisherId, { intentId, reason: reason ?? "other" });
  return revoked;
}
