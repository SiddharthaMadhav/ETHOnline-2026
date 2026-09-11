import { describe, expect, it } from "vitest";
import { containsObviousPii } from "../src/pii.js";

describe("containsObviousPii", () => {
  it("flags email addresses", () => {
    expect(containsObviousPii("Contact me at alex@example.com about laptops")).toBe(true);
  });

  it("flags phone numbers", () => {
    expect(containsObviousPii("Call 555-123-4567 for details")).toBe(true);
  });

  it("does not flag ordinary commercial summaries", () => {
    expect(containsObviousPii("Looking for something lightweight for college coding.")).toBe(
      false,
    );
  });
});
