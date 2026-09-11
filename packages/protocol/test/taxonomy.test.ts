import { describe, expect, it } from "vitest";
import { isSameOrDescendant, isValidTopicId, topicDistance } from "../src/taxonomy.js";

describe("taxonomy", () => {
  it("validates known and unknown topic ids", () => {
    expect(isValidTopicId("electronics.computer.laptop")).toBe(true);
    expect(isValidTopicId("not.a.real.topic")).toBe(false);
  });

  it("treats a topic as same-or-descendant of itself", () => {
    expect(isSameOrDescendant("electronics.computer.laptop", "electronics.computer.laptop")).toBe(
      true,
    );
  });

  it("treats a child topic as a descendant of its parent", () => {
    expect(isSameOrDescendant("electronics.computer.laptop", "electronics.computer")).toBe(true);
    expect(isSameOrDescendant("electronics.computer.laptop", "electronics")).toBe(true);
  });

  it("does not treat a parent as a descendant of its child", () => {
    expect(isSameOrDescendant("electronics.computer", "electronics.computer.laptop")).toBe(false);
  });

  it("does not treat unrelated topics as descendants", () => {
    expect(isSameOrDescendant("travel.flight", "electronics.computer.laptop")).toBe(false);
  });

  it("computes zero distance for identical topics", () => {
    expect(topicDistance("electronics.computer.laptop", "electronics.computer.laptop")).toBe(0);
  });

  it("computes distance through a common ancestor", () => {
    expect(topicDistance("electronics.computer.laptop", "electronics.computer.desktop")).toBe(2);
    expect(topicDistance("electronics.computer.laptop", "electronics.phone")).toBe(3);
  });

  it("returns Infinity for topics with no shared ancestor", () => {
    expect(topicDistance("electronics.computer.laptop", "travel.flight")).toBe(Infinity);
  });
});
