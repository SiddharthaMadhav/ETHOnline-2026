import { Router, type Router as ExpressRouter } from "express";
import type { HarkDatabase } from "@hark-protocol/db";
import { listOpportunities } from "../services/opportunity-service.js";
import { discoveryRateLimit } from "../middleware/rate-limit.js";

export function opportunitiesRouter(db: HarkDatabase): ExpressRouter {
  const router = Router();

  router.get("/v1/opportunities", discoveryRateLimit, async (req, res, next) => {
    try {
      const campaignId =
        typeof req.query.campaignId === "string" ? req.query.campaignId : undefined;
      const items = await listOpportunities(db, campaignId);
      res.json({ items });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
