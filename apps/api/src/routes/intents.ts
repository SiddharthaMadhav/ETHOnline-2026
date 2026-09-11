import { Router, type Router as ExpressRouter } from "express";
import type { HarkDatabase } from "@hark-protocol/db";
import {
  createIntentInputSchema,
  revokeIntentInputSchema,
  updateIntentInputSchema,
} from "@hark-protocol/protocol";
import { publisherAuth, requirePublisher } from "../middleware/publisher-auth.js";
import { createIntent, revokeIntent, updateIntent } from "../services/intent-service.js";

export function intentsRouter(db: HarkDatabase): ExpressRouter {
  const router = Router();
  const auth = publisherAuth(db);

  router.post("/v1/intents", auth, async (req, res, next) => {
    try {
      const publisher = requirePublisher(req);
      const input = createIntentInputSchema.parse(req.body);
      const intent = await createIntent(db, publisher.id, input);
      res.status(201).json(intent);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/v1/intents/:intentId", auth, async (req, res, next) => {
    try {
      const publisher = requirePublisher(req);
      const input = updateIntentInputSchema.parse(req.body);
      const intent = await updateIntent(db, publisher.id, req.params.intentId, input);
      res.json(intent);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/v1/intents/:intentId", auth, async (req, res, next) => {
    try {
      const publisher = requirePublisher(req);
      const input = revokeIntentInputSchema.parse(req.body ?? {});
      const intent = await revokeIntent(db, publisher.id, req.params.intentId, input.reason);
      res.json(intent);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
