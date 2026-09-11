import { Router, type Router as ExpressRouter } from "express";
import type { HarkDatabase } from "@hark-protocol/db";
import { createCampaignInputSchema } from "@hark-protocol/protocol";
import { createCampaign, listActiveCampaigns } from "../services/campaign-service.js";
import { discoveryRateLimit } from "../middleware/rate-limit.js";

/** Open dev endpoint for the hackathon demo (CLAUDE.md section 12). */
export function campaignsRouter(db: HarkDatabase): ExpressRouter {
  const router = Router();

  router.post("/v1/campaigns", async (req, res, next) => {
    try {
      const input = createCampaignInputSchema.parse(req.body);
      const campaign = await createCampaign(db, input);
      res.status(201).json(campaign);
    } catch (error) {
      next(error);
    }
  });

  // Public list for the Explorer/agent dashboard - nothing here is sensitive.
  router.get("/v1/campaigns", discoveryRateLimit, async (_req, res, next) => {
    try {
      const items = await listActiveCampaigns(db);
      res.json({ items });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
