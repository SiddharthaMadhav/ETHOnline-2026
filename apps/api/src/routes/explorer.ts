import { Router, type Router as ExpressRouter } from "express";
import type { HarkDatabase } from "@hark-protocol/db";
import { getExplorerSummary } from "../services/explorer-service.js";
import { discoveryRateLimit } from "../middleware/rate-limit.js";

/**
 * Public, aggregate, sanitized system state for the Hark Explorer
 * (CLAUDE.md section 23). Never returns subjectRef, publisher secrets,
 * or private keys.
 */
export function explorerRouter(db: HarkDatabase): ExpressRouter {
  const router = Router();

  router.get("/v1/explorer/summary", discoveryRateLimit, async (_req, res, next) => {
    try {
      const summary = await getExplorerSummary(db);
      res.json(summary);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
