import type { RequestHandler } from "express";
import { paymentMiddleware } from "@x402/express";
import type { RoutesConfig } from "@x402/core/server";
import type { Network } from "@x402/core/types";
import type { HarkDatabase } from "@hark-protocol/db";
import { config } from "../config.js";
import { createResourceServer } from "./resource-server.js";

/** x402-protects POST /v1/reach (CLAUDE.md sections 12, 18). */
export function createReachPaymentMiddleware(db: HarkDatabase): RequestHandler {
  if (!config.hederaPayToAccountId) {
    throw new Error(
      "HEDERA_PAY_TO_ACCOUNT_ID is not set - required to protect POST /v1/reach with x402",
    );
  }

  const routes: RoutesConfig = {
    "POST /v1/reach": {
      accepts: {
        scheme: "exact",
        network: config.hederaNetwork as Network,
        payTo: config.hederaPayToAccountId,
        price: { asset: "0.0.0", amount: config.reachPriceTinybar },
      },
      description: "Deliver an advertisement to an anonymous user with a matching active intent",
    },
  };

  const resourceServer = createResourceServer(db);

  return paymentMiddleware(routes, resourceServer);
}
