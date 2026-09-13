import { Router, type Router as ExpressRouter } from "express";
import type { HarkDatabase } from "@hark-protocol/db";
import { schema } from "@hark-protocol/db";
import { eq } from "drizzle-orm";
import { discoveryRateLimit } from "../middleware/rate-limit.js";
import { publisherAuth, requirePublisher } from "../middleware/publisher-auth.js";
import { getPublisherBalance } from "../services/payout-service.js";

/** Non-sensitive publisher directory for the demo/explorer (CLAUDE.md section 23). */
export function publishersRouter(db: HarkDatabase): ExpressRouter {
  const router = Router();
  const auth = publisherAuth(db);

  // Publisher revenue-share balance - the accrued, not-yet-paid-out
  // publisher share of settled reach payments (design in docs/STATUS.md).
  router.get("/v1/publishers/me/balance", auth, async (req, res, next) => {
    try {
      const publisher = requirePublisher(req);
      const balance = await getPublisherBalance(db, publisher.id);
      res.json(balance);
    } catch (error) {
      next(error);
    }
  });

  // Placements are embedded so a publisher-side client (e.g. the Demo
  // Publisher web app) can discover which placement id to attach to an
  // intent without a separate lookup - not sensitive, already advertised to
  // advertisers via opportunities' own placement field.
  router.get("/v1/publishers", discoveryRateLimit, async (_req, res) => {
    const rows = await db.query.publishers.findMany({ where: eq(schema.publishers.active, true) });
    const items = await Promise.all(
      rows.map(async (row) => {
        const placements = await db.query.placements.findMany({
          where: (fields, { and: andOp, eq: eqOp }) => andOp(eqOp(fields.publisherId, row.id), eqOp(fields.active, true)),
        });
        return {
          id: row.id,
          slug: row.slug,
          name: row.name,
          domain: row.domain ?? undefined,
          placements: placements.map((placement) => ({
            id: placement.id,
            slug: placement.slug,
            name: placement.name,
            format: placement.format,
          })),
        };
      }),
    );
    res.json({ items });
  });

  return router;
}
