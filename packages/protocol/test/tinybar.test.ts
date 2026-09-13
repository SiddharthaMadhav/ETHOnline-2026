import { describe, expect, it } from "vitest";
import { splitTinybarByBps, tinybarAdd, tinybarLte } from "../src/tinybar.js";

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

describe("splitTinybarByBps", () => {
  it("splits an evenly-divisible amount with no remainder loss", () => {
    const { share, remainder } = splitTinybarByBps("100000", 8000);
    expect(share).toBe("80000");
    expect(remainder).toBe("20000");
  });

  it("always conserves the total even when the split doesn't divide evenly", () => {
    const { share, remainder } = splitTinybarByBps("100001", 8000);
    expect(tinybarAdd(share, remainder)).toBe("100001");
  });

  it("rounds the share down, putting rounding loss into the remainder", () => {
    const { share, remainder } = splitTinybarByBps("3", 5000);
    expect(share).toBe("1");
    expect(remainder).toBe("2");
  });

  it("handles 0 bps and 10000 bps as the extremes", () => {
    expect(splitTinybarByBps("100000", 0)).toEqual({ share: "0", remainder: "100000" });
    expect(splitTinybarByBps("100000", 10000)).toEqual({ share: "100000", remainder: "0" });
  });

  it("rejects an out-of-range or non-integer bps value", () => {
    expect(() => splitTinybarByBps("100000", -1)).toThrow(RangeError);
    expect(() => splitTinybarByBps("100000", 10001)).toThrow(RangeError);
    expect(() => splitTinybarByBps("100000", 50.5)).toThrow(RangeError);
  });

  it("handles values beyond safe-integer precision correctly", () => {
    const { share, remainder } = splitTinybarByBps("9007199254740993", 8000);
    expect(tinybarAdd(share, remainder)).toBe("9007199254740993");
  });
});
