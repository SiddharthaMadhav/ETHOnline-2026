/**
 * Batch publisher revenue-share payout run. One real Hedera transfer per
 * publisher with an accrued balance above the configured minimum - never
 * per-reach (see payout-service.ts and docs/STATUS.md for the design).
 *
 * Usage: pnpm payout:run
 */
import { createDb, schema } from "@hark-protocol/db";
import { eq } from "drizzle-orm";
import { config } from "../config.js";
import { runPublisherPayout } from "../services/payout-service.js";

async function main(): Promise<void> {
  const db = createDb(config.databaseUrl);

  const publishers = await db.query.publishers.findMany({ where: eq(schema.publishers.active, true) });
  console.log(`Checking ${publishers.length} active publisher(s) for a payout...`);

  let paid = 0;
  let skipped = 0;
  let failed = 0;

  for (const publisher of publishers) {
    const result = await runPublisherPayout(db, publisher.id);
    switch (result.status) {
      case "paid":
        paid += 1;
        console.log(
          `[paid] ${publisher.name} (${publisher.id}): ${result.totalTinybar} tinybar - tx ${result.transactionId}`,
        );
        break;
      case "skipped":
        skipped += 1;
        console.log(`[skip] ${publisher.name} (${publisher.id}): ${result.reason}`);
        break;
      case "failed":
        failed += 1;
        console.error(
          `[FAIL] ${publisher.name} (${publisher.id}): payout ${result.payoutId} for ${result.totalTinybar} tinybar failed - ${result.error}`,
        );
        break;
    }
  }

  console.log(`Done: ${paid} paid, ${skipped} skipped, ${failed} failed.`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("Payout run failed:", error);
  process.exit(1);
});
