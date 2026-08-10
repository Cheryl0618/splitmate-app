import { describe, expect, it } from "vitest";

import { filterExpenses, totalExpenseCents } from "./expense-filter";

const expenses = [
  { description: "早餐咖啡", amountCents: 2_500, category: "咖啡" as const },
  { description: "朋友聚餐", amountCents: 12_000, category: "餐饮" as const },
  { description: "机场打车", amountCents: 4_500, category: "交通" as const },
];

describe("expense filtering", () => {
  it("uses OR between categories and AND with the text query", () => {
    expect(
      filterExpenses(expenses, "聚餐", ["餐饮", "咖啡"], "CNY").map(
        (expense) => expense.description
      )
    ).toEqual(["朋友聚餐"]);
  });

  it("matches formatted and plain major-unit amounts", () => {
    expect(filterExpenses(expenses, "120.00", [], "CNY")).toEqual([
      expenses[1],
    ]);
  });

  it("totals only the filtered results", () => {
    const filtered = filterExpenses(expenses, "", ["咖啡", "交通"], "CNY");
    expect(totalExpenseCents(filtered)).toBe(7_000);
  });
});
