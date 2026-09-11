import { describe, expect, it } from "vitest";
import { canAffordReach } from "../src/budget.js";

describe("canAffordReach", () => {
  it("allows a price within both the max price and the remaining run budget", () => {
    expect(canAffordReach({ spentTinybar: "0", runBudgetTinybar: "1000000" }, "100000", "150000")).toBe(
      true,
    );
  });

  it("rejects a price above the campaign's max price", () => {
    expect(canAffordReach({ spentTinybar: "0", runBudgetTinybar: "1000000" }, "200000", "150000")).toBe(
      false,
    );
  });

  it("rejects when spent + price would exceed the run budget", () => {
    expect(
      canAffordReach({ spentTinybar: "950000", runBudgetTinybar: "1000000" }, "100000", "150000"),
    ).toBe(false);
  });

  it("allows exactly at the run-budget boundary", () => {
    expect(
      canAffordReach({ spentTinybar: "900000", runBudgetTinybar: "1000000" }, "100000", "150000"),
    ).toBe(true);
  });

  it("handles amounts beyond safe-integer precision correctly", () => {
    expect(
      canAffordReach(
        { spentTinybar: "9007199254740992", runBudgetTinybar: "9007199254840992" },
        "100000",
        "150000",
      ),
    ).toBe(true);
  });
});
