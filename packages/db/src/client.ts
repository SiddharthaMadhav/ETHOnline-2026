import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

export type HarkDatabase = ReturnType<typeof drizzle<typeof schema>>;

export function createDb(databaseUrl: string): HarkDatabase {
  const pool = new Pool({ connectionString: databaseUrl });
  return drizzle(pool, { schema });
}
