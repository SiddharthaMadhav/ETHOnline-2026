import { describe, expect, it } from "vitest";
import { tinybarAdd, tinybarLte } from "../src/services/tinybar.js";

describe("tinybarLte", () => {
  it("is true when equal", () => {
    expect(tinybarLte("100000", "100000")).toBe(true);
  });

  it("is true when strictly less", () => {
    expect(tinybarLte("99999", "100000")).toBe(true);
  });

  it("is false when greater", () => {
    expect(tinybarLte("100001", "100000")).toBe(false);
  });

  it("handles values beyond safe-integer precision correctly", () => {
    // Number("9007199254740993") loses precision; BigInt must not.
    expect(tinybarLte("9007199254740993", "9007199254740992")).toBe(false);
    expect(tinybarLte("9007199254740992", "9007199254740993")).toBe(true);
  });
});

describe("tinybarAdd", () => {
  it("adds two tinybar strings", () => {
    expect(tinybarAdd("100000", "50000")).toBe("150000");
  });

  it("adds correctly beyond safe-integer precision", () => {
    expect(tinybarAdd("9007199254740992", "1")).toBe("9007199254740993");
  });
});
