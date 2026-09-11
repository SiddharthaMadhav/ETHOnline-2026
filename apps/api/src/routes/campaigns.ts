import { Router, type Router as ExpressRouter } from "express";
import type { HarkDatabase } from "@hark-protocol/db";
import { createCampaignInputSchema } from "@hark-protocol/protocol";
import { createCampaign } from "../services/campaign-service.js";

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

  return router;
}
