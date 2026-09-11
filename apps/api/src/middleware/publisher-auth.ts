import type { NextFunction, Request, Response } from "express";
import { verifySecret, type HarkDatabase, schema } from "@hark-protocol/db";
import { AppError } from "./error-handler.js";

/**
 * Resolves the calling publisher from `Authorization: Bearer <secret>`.
 * There is no publisher slug in the header, so the secret is checked
 * against every active publisher's hash - fine at demo scale (CLAUDE.md
 * section 11).
 */
export function publisherAuth(db: HarkDatabase) {
  return async function publisherAuthMiddleware(req: Request, _res: Response, next: NextFunction) {
    try {
      const header = req.headers.authorization;
      if (!header?.startsWith("Bearer ")) {
        throw new AppError("UNAUTHORIZED_PUBLISHER", "Missing publisher bearer token");
      }
      const secret = header.slice("Bearer ".length).trim();
      if (!secret) {
        throw new AppError("UNAUTHORIZED_PUBLISHER", "Missing publisher bearer token");
      }

      const activePublishers = await db.query.publishers.findMany({
        where: (fields, { eq }) => eq(fields.active, true),
      });

      for (const publisher of activePublishers) {
        if (await verifySecret(secret, publisher.apiKeyHash)) {
          req.publisher = publisher;
          next();
          return;
        }
      }

      throw new AppError("UNAUTHORIZED_PUBLISHER", "Invalid publisher credentials");
    } catch (error) {
      next(error);
    }
  };
}

export function requirePublisher(req: Request): typeof schema.publishers.$inferSelect {
  if (!req.publisher) {
    throw new AppError("UNAUTHORIZED_PUBLISHER", "Publisher authentication required");
  }
  return req.publisher;
}
