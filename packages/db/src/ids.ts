import { randomUUID } from "node:crypto";
import { ID_PREFIX, type IdKind } from "@hark-protocol/protocol";

/** Generates a stable, opaque, prefixed public id (CLAUDE.md section 50). */
export function generateId(kind: IdKind): string {
  return `${ID_PREFIX[kind]}${randomUUID()}`;
}
