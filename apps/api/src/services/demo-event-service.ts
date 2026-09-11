import { randomUUID } from "node:crypto";
import { desc, lt } from "drizzle-orm";
import type { HarkDatabase } from "@hark-protocol/db";
import { schema } from "@hark-protocol/db";

export type DemoEventType =
  | "intent.created"
  | "intent.updated"
  | "intent.revoked"
  | "reach.payment_verified"
  | "reach.payment_settled"
  | "delivery.queued"
  | "delivery.served";

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
