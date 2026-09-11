import { Router, type Router as ExpressRouter } from "express";
import type { HarkDatabase } from "@hark-protocol/db";
import { schema } from "@hark-protocol/db";
import { eq } from "drizzle-orm";
import { discoveryRateLimit } from "../middleware/rate-limit.js";

/** Non-sensitive publisher directory for the demo/explorer (CLAUDE.md section 23). */
export function publishersRouter(db: HarkDatabase): ExpressRouter {
  const router = Router();

  router.get("/v1/publishers", discoveryRateLimit, async (_req, res) => {
    const rows = await db.query.publishers.findMany({ where: eq(schema.publishers.active, true) });
    res.json({
      items: rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        domain: row.domain ?? undefined,
      })),
    });
  });

  return router;
}
