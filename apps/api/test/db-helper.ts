import { fileURLToPath } from "node:url";
import path from "node:path";
import { Client } from "pg";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { createDb, type HarkDatabase } from "@hark-protocol/db";
import { schema } from "@hark-protocol/db";

const BASE_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/hark";
const TEST_DB_NAME = "hark_test";

function withDatabase(url: string, databaseName: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${databaseName}`;
  return parsed.toString();
}

const maintenanceUrl = withDatabase(BASE_URL, "postgres");
const testDatabaseUrl = withDatabase(BASE_URL, TEST_DB_NAME);

export async function ensureTestDatabaseExists(): Promise<void> {
  const client = new Client({ connectionString: maintenanceUrl });
  await client.connect();
  try {
    const result = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [
      TEST_DB_NAME,
    ]);
    if (result.rowCount === 0) {
      await client.query(`CREATE DATABASE ${TEST_DB_NAME}`);
    }
  } finally {
    await client.end();
  }
}

export async function runMigrations(): Promise<void> {
  const migrationsFolder = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "..",
    "packages",
    "db",
    "drizzle",
  );
  const client = new Client({ connectionString: testDatabaseUrl });
  await client.connect();
  try {
    const db = drizzle(client);
    await migrate(db, { migrationsFolder });
  } finally {
    await client.end();
  }
}

/**
 * Assumes migrations have already been applied by the vitest global setup
 * (test/global-setup.ts) - safe to call from every parallel test file
 * without racing concurrent `CREATE DATABASE`/migration runs.
 */
export function getTestDb(): HarkDatabase {
  return createDb(testDatabaseUrl);
}

const TABLES = [
  schema.demoEvents,
  schema.deliveries,
  schema.payments,
  schema.opportunities,
  schema.campaignTopics,
  schema.campaigns,
  schema.advertiserAgents,
  schema.intentPlacements,
  schema.intentTopics,
  schema.intents,
  schema.placements,
  schema.publishers,
];

export async function truncateAll(db: HarkDatabase): Promise<void> {
  for (const table of TABLES) {
    await db.execute(sql`TRUNCATE TABLE ${table} CASCADE`);
  }
}
