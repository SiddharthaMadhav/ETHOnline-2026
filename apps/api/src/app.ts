import express, { type Express } from "express";
import type { HarkDatabase } from "@hark-protocol/db";
import { healthRouter } from "./routes/health.js";
import { discoveryRouter } from "./routes/discovery.js";
import { publishersRouter } from "./routes/publishers.js";
import { intentsRouter } from "./routes/intents.js";
import { campaignsRouter } from "./routes/campaigns.js";
import { opportunitiesRouter } from "./routes/opportunities.js";
import { feedRouter } from "./routes/feed.js";
import { demoEventsRouter } from "./routes/demo-events.js";
import { explorerRouter } from "./routes/explorer.js";
import { reachRouter } from "./routes/reach.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { createReachPaymentMiddleware } from "./x402/payment-middleware.js";

export function createApp(db: HarkDatabase): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json());

  app.use(healthRouter);
  app.use(discoveryRouter);
  app.use(publishersRouter(db));
  app.use(intentsRouter(db));
  app.use(campaignsRouter(db));
  app.use(opportunitiesRouter(db));
  app.use(feedRouter(db));
  app.use(demoEventsRouter(db));
  app.use(explorerRouter(db));

  // x402 payment protection for POST /v1/reach - must be mounted before the
  // route handler below so it can verify/settle around it.
  app.use(createReachPaymentMiddleware(db));
  app.use(reachRouter(db));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
