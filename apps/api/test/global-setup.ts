import { ensureTestDatabaseExists, runMigrations } from "./db-helper.js";

export default async function globalSetup(): Promise<void> {
  await ensureTestDatabaseExists();
  await runMigrations();
}
