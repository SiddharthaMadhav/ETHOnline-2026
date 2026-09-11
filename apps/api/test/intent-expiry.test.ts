import { describe, expect, it } from "vitest";
import { isIntentActive } from "../src/services/intent-service.js";

describe("isIntentActive", () => {
  const now = new Date("2026-01-01T00:00:00Z");

  it("is active when not expired and not revoked", () => {
    expect(
      isIntentActive({ expiresAt: new Date("2026-02-01T00:00:00Z"), revokedAt: null }, now),
    ).toBe(true);
  });

  it("is inactive once expired", () => {
    expect(
      isIntentActive({ expiresAt: new Date("2025-12-01T00:00:00Z"), revokedAt: null }, now),
    ).toBe(false);
  });

  it("is inactive once revoked, even if not yet expired", () => {
    expect(
      isIntentActive(
        { expiresAt: new Date("2026-02-01T00:00:00Z"), revokedAt: new Date("2025-12-15T00:00:00Z") },
        now,
      ),
    ).toBe(false);
  });
});
