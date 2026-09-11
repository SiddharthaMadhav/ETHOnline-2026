import type { HarkDatabase } from "@hark-protocol/db";
import { schema, generateId, hashSecret } from "@hark-protocol/db";

export async function createTestPublisher(
  db: HarkDatabase,
  overrides: { slug?: string; secret?: string } = {},
) {
  const secret = overrides.secret ?? "test-secret";
  const apiKeyHash = await hashSecret(secret);
  const [publisher] = await db
    .insert(schema.publishers)
    .values({
      id: generateId("publisher"),
      slug: overrides.slug ?? `test-publisher-${generateId("publisher")}`,
      name: "Test Publisher",
      apiKeyHash,
      active: true,
    })
    .returning();
  return { publisher: publisher!, secret };
}

export async function createTestPlacement(db: HarkDatabase, publisherId: string) {
  const [placement] = await db
    .insert(schema.placements)
    .values({
      id: generateId("placement"),
      publisherId,
      slug: "home-feed",
      name: "Home Feed",
      format: "card",
      active: true,
    })
    .returning();
  return placement!;
}
