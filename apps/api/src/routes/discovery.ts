import { Router, type Router as ExpressRouter } from "express";
import { listTopics } from "@hark-protocol/protocol";
import { config } from "../config.js";
import { discoveryRateLimit } from "../middleware/rate-limit.js";

export const discoveryRouter: ExpressRouter = Router();

discoveryRouter.get("/.well-known/hark.json", (_req, res) => {
  res.json({
    name: "Hark Protocol",
    protocolVersion: "0.1.0",
    description: "Intent-aware advertising for autonomous advertiser agents",
    network: config.hederaNetwork,
    paymentProtocol: "x402",
    asset: "0.0.0",
    services: [
      {
        name: "reach",
        method: "POST",
        path: "/v1/reach",
        paid: true,
      },
    ],
  });
});

discoveryRouter.get("/v1/topics", discoveryRateLimit, (_req, res) => {
  res.json({ items: listTopics() });
});
