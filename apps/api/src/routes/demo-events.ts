import { Router, type Router as ExpressRouter } from "express";
import type { HarkDatabase } from "@hark-protocol/db";
import { createDemoEvent, createDemoEventInputSchema, listDemoEvents } from "../services/demo-event-service.js";
import { discoveryRateLimit } from "../middleware/rate-limit.js";

export function demoEventsRouter(db: HarkDatabase): ExpressRouter {
  const router = Router();

  router.get("/v1/demo-events", discoveryRateLimit, async (req, res, next) => {
    try {
      const limit = req.query.limit ? Number.parseInt(String(req.query.limit), 10) : undefined;
      const before = typeof req.query.before === "string" ? req.query.before : undefined;
      const items = await listDemoEvents(db, { limit, before });
      res.json({ items });
    } catch (error) {
      next(error);
    }
  });

  // Open, no publisher auth: agents are anonymous already, and the type enum
  // this validates against (demo-event-service.ts) keeps this from becoming
  // an arbitrary-write log. CLAUDE.md section 10 lists agent-originated event
  // types as part of this same table by design.
  router.post("/v1/demo-events", discoveryRateLimit, async (req, res, next) => {
    try {
      const input = createDemoEventInputSchema.parse(req.body);
      const event = await createDemoEvent(db, input);
      res.status(201).json(event);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
