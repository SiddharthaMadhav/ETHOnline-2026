import { Router, type Router as ExpressRouter } from "express";
import type { HarkDatabase } from "@hark-protocol/db";
import { listDemoEvents } from "../services/demo-event-service.js";

export function demoEventsRouter(db: HarkDatabase): ExpressRouter {
  const router = Router();

  router.get("/v1/demo-events", async (req, res, next) => {
    try {
      const limit = req.query.limit ? Number.parseInt(String(req.query.limit), 10) : undefined;
      const before = typeof req.query.before === "string" ? req.query.before : undefined;
      const items = await listDemoEvents(db, { limit, before });
      res.json({ items });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
