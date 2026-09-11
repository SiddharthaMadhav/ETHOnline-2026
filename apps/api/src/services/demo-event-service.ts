import { randomUUID } from "node:crypto";
import { z } from "zod";
import { desc, lt } from "drizzle-orm";
import type { HarkDatabase } from "@hark-protocol/db";
import { schema } from "@hark-protocol/db";

/**
 * Server-emitted types plus the agent-originated types CLAUDE.md section 10
 * lists as examples (agent.opportunities_fetched/relevance_scored/skipped) -
 * agents post these themselves via POST /v1/demo-events (demo-events.ts),
 * validated against this same enum so that endpoint can't become an
 * arbitrary-write log.
 */
export const demoEventTypeSchema = z.enum([
  "intent.created",
  "intent.updated",
  "intent.revoked",
  "reach.payment_verified",
  "reach.payment_settled",
  "delivery.queued",
  "delivery.served",
  "agent.opportunities_fetched",
  "agent.relevance_scored",
  "agent.skipped",
]);
export type DemoEventType = z.infer<typeof demoEventTypeSchema>;

export const createDemoEventInputSchema = z.object({
  type: demoEventTypeSchema,
  actor: z.string().min(1).max(200),
  data: z.record(z.string(), z.unknown()).optional(),
});
export type CreateDemoEventInput = z.infer<typeof createDemoEventInputSchema>;

type DemoEventRow = typeof schema.demoEvents.$inferSelect;

export type DemoEventDto = {
  id: string;
  type: string;
  actor: string;
  data: unknown;
  createdAt: string;
};

function serialize(row: DemoEventRow): DemoEventDto {
  return {
    id: row.id,
    type: row.type,
    actor: row.actor,
    data: row.dataJson ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function recordDemoEvent(
  db: HarkDatabase,
  type: DemoEventType,
  actor: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  await db.insert(schema.demoEvents).values({
    id: `evt_${randomUUID()}`,
    type,
    actor,
    dataJson: data,
  });
}

/** Used by the public POST /v1/demo-events route - returns the created row. */
export async function createDemoEvent(
  db: HarkDatabase,
  input: CreateDemoEventInput,
): Promise<DemoEventDto> {
  const [row] = await db
    .insert(schema.demoEvents)
    .values({
      id: `evt_${randomUUID()}`,
      type: input.type,
      actor: input.actor,
      dataJson: input.data ?? {},
    })
    .returning();
  return serialize(row!);
}

export async function listDemoEvents(
  db: HarkDatabase,
  options: { limit?: number; before?: string } = {},
): Promise<DemoEventDto[]> {
  const limit = Math.min(options.limit ?? 50, 200);
  const rows = await db.query.demoEvents.findMany({
    where: options.before ? lt(schema.demoEvents.id, options.before) : undefined,
    orderBy: desc(schema.demoEvents.createdAt),
    limit,
  });
  return rows.map(serialize);
}
