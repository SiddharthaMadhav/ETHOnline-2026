import { x402ResourceServer } from "@x402/core/server";
import { ExactHederaScheme } from "@x402/hedera/exact/server";
import type { HarkDatabase } from "@hark-protocol/db";
import { facilitatorClient } from "./facilitator.js";
import { finalizeSettledPayment } from "../services/payment-service.js";

/**
 * Shape of the transport context the express middleware actually passes to
 * resource-server hooks - verified by reading @x402/express's compiled JS
 * (`processSettlement(paymentPayload, requirements, extensions,
 * { request: context, responseBody, responseHeaders }, ...)`, where `context`
 * wraps the real Express request behind an ExpressAdapter). Not part of the
 * published types (`transportContext` is typed `unknown`), so this is a
 * best-effort read: if the shape ever changes, `getBody` below just returns
 * undefined and the backfill below is skipped rather than throwing.
 */
type ExpressHTTPTransportContext = {
  request?: {
    adapter?: {
      getBody?: () => unknown;
    };
  };
};

/**
 * Builds the x402 resource server for POST /v1/reach.
 *
 * Settlement for the scheme's default "authorization" payment flow happens
 * *after* our route handler responds (see payment-middleware.ts for why that
 * means our handler's own JSON body can't carry the transaction id). This
 * hook is where the real transaction id becomes known, and it backfills the
 * pending payment row created by the handler - correlated via `opportunityId`
 * read straight off the original request body, since that's guaranteed
 * present on every /v1/reach call regardless of what the client sends as
 * headers.
 */
export function createResourceServer(db: HarkDatabase): x402ResourceServer {
  const resourceServer = new x402ResourceServer(facilitatorClient);

  resourceServer.register(
    "hedera:testnet",
    new ExactHederaScheme({
      defaultAssets: {
        "hedera:testnet": { asset: "0.0.0", decimals: 8 },
      },
    }),
  );

  resourceServer.onAfterSettle(async (context) => {
    try {
      const transportContext = context.transportContext as ExpressHTTPTransportContext | undefined;
      const body = transportContext?.request?.adapter?.getBody?.() as
        | { opportunityId?: unknown }
        | undefined;
      const opportunityId = typeof body?.opportunityId === "string" ? body.opportunityId : undefined;
      const transactionId = context.result.transaction;
      if (!opportunityId || !transactionId) return;

      await finalizeSettledPayment(db, opportunityId, {
        transactionId,
        payerAccountId: context.result.payer,
      });
    } catch (error) {
      // Settlement already succeeded on-chain at this point - never let a
      // backfill failure surface as a request error. Log and move on.
      console.error("Failed to backfill settled payment transaction id:", error);
    }
  });

  return resourceServer;
}
