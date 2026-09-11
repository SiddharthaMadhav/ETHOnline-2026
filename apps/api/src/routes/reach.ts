import { randomUUID } from "node:crypto";
import { Router, type Router as ExpressRouter } from "express";
import type { HarkDatabase } from "@hark-protocol/db";
import { reachInputSchema } from "@hark-protocol/protocol";
import { reserveOpportunityAndCreateDelivery } from "../services/payment-service.js";

/**
 * By the time this handler runs, @x402/express's payment middleware
 * (mounted before this router in app.ts) has already verified payment for
 * the request - see x402/payment-middleware.ts and x402/resource-server.ts
 * for why settlement itself happens after this handler responds.
 */
export function reachRouter(db: HarkDatabase): ExpressRouter {
  const router = Router();

  router.post("/v1/reach", async (req, res, next) => {
    try {
      const input = reachInputSchema.parse(req.body);
      const idempotencyKey = String(req.header("x-hark-idempotency-key") ?? randomUUID());

      const confirmation = await reserveOpportunityAndCreateDelivery(db, {
        opportunityId: input.opportunityId,
        campaignId: input.campaignId,
        idempotencyKey,
      });

      res.status(200).json(confirmation);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
