import type { schema } from "@hark-protocol/db";

type PublisherRow = typeof schema.publishers.$inferSelect;

declare global {
  namespace Express {
    interface Request {
      publisher?: PublisherRow;
    }
  }
}

export {};
