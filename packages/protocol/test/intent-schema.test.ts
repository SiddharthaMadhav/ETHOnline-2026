import { describe, expect, it } from "vitest";
import { createIntentInputSchema } from "../src/schemas/intent.js";
import { INTENT_DEFAULT_TTL_SECONDS, INTENT_MAX_TTL_SECONDS } from "../src/constants.js";

const baseInput = {
  subjectRef: "user-demo-001",
  placementIds: ["plc_1"],
  topics: [{ id: "electronics.computer.laptop", confidence: 0.91 }],
  semanticSummary: "Looking for something lightweight for college coding.",
};

describe("createIntentInputSchema", () => {
  it("accepts a valid minimal intent with just a topic", () => {
    const result = createIntentInputSchema.safeParse({
      subjectRef: "user-demo-001",
      placementIds: ["plc_1"],
      topics: [{ id: "electronics.computer.laptop" }],
    });
    expect(result.success).toBe(true);
  });

  it("defaults expiresInSeconds to the 30-day TTL", () => {
    const result = createIntentInputSchema.parse(baseInput);
    expect(result.expiresInSeconds).toBe(INTENT_DEFAULT_TTL_SECONDS);
  });

  it("rejects a TTL beyond the 90-day maximum", () => {
    const result = createIntentInputSchema.safeParse({
      ...baseInput,
      expiresInSeconds: INTENT_MAX_TTL_SECONDS + 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown topic id", () => {
    const result = createIntentInputSchema.safeParse({
      ...baseInput,
      topics: [{ id: "not.a.real.topic" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a confidence value outside 0..1", () => {
    const result = createIntentInputSchema.safeParse({
      ...baseInput,
      topics: [{ id: "electronics.computer.laptop", confidence: 1.5 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a semantic summary containing an email address", () => {
    const result = createIntentInputSchema.safeParse({
      ...baseInput,
      semanticSummary: "Reach me at alex@example.com about laptops.",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a semantic summary longer than 280 characters", () => {
    const result = createIntentInputSchema.safeParse({
      ...baseInput,
      semanticSummary: "a".repeat(281),
    });
    expect(result.success).toBe(false);
  });

  it("requires at least one topic", () => {
    const result = createIntentInputSchema.safeParse({
      ...baseInput,
      topics: [],
    });
    expect(result.success).toBe(false);
  });
});
