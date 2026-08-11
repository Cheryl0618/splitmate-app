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

  it("uses the typographic minus sign for negative amounts", () => {
    expect(formatCents(-6_000, "CNY")).toBe("−¥60.00");
  });

  it("uses locale-specific currency notation", () => {
    expect(formatCents(12_345, "USD", "zh")).toBe("US$123.45");
    expect(formatCents(12_345, "CNY", "en")).toBe("CN¥123.45");
  });
});
