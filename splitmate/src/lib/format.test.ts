import { describe, expect, it } from "vitest";

import { formatCents } from "./format";

describe("formatCents", () => {
  it.each([
    ["CNY", "¥123.45"],
    ["USD", "$123.45"],
    ["EUR", "€123.45"],
    ["GBP", "£123.45"],
    ["JPY", "¥123"],
    ["CAD", "CA$123.45"],
    ["KRW", "₩123"],
    ["TWD", "NT$123.45"],
  ] as const)("formats %s with its own symbol and decimals", (currency, expected) => {
    expect(formatCents(12_345, currency)).toBe(expected);
  });

  it("adds thousands separators to summary amounts", () => {
    expect(formatCents(124_000, "CNY")).toBe("¥1,240.00");
  });
});
