import { Router, type Router as ExpressRouter } from "express";
import type { HarkDatabase } from "@hark-protocol/db";
import { publisherAuth, requirePublisher } from "../middleware/publisher-auth.js";
import { listFeedForSubject, markDeliveryServed } from "../services/delivery-service.js";

export function feedRouter(db: HarkDatabase): ExpressRouter {
  const router = Router();
  const auth = publisherAuth(db);

  router.get("/v1/feed/:subjectRef", auth, async (req, res, next) => {
    try {
      const publisher = requirePublisher(req);
      const items = await listFeedForSubject(db, publisher.id, req.params.subjectRef);
      res.json({ items });
    } catch (error) {
      next(error);
    }
  });

  router.post("/v1/deliveries/:deliveryId/served", auth, async (req, res, next) => {
    try {
      const publisher = requirePublisher(req);
      const delivery = await markDeliveryServed(db, publisher.id, req.params.deliveryId);
      res.json(delivery);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
