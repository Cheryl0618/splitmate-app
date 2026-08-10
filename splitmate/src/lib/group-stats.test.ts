import { describe, expect, it } from "vitest";

import { computeGroupStats } from "./group-stats";
import { homeGroupSeed } from "./seed-data";

describe("computeGroupStats", () => {
  const stats = computeGroupStats(
    homeGroupSeed.expenses,
    homeGroupSeed.settlements,
    homeGroupSeed.members
  );

  it("keeps category totals equal to total spending", () => {
    expect(
      stats.byCategory.reduce((total, category) => total + category.cents, 0)
    ).toBe(stats.totalCents);
  });

  it("keeps member burden totals equal to total spending", () => {
    expect(
      stats.byMember.reduce((total, member) => total + member.burdenCents, 0)
    ).toBe(stats.totalCents);
  });

  it("keeps member paid totals equal to total spending", () => {
    expect(
      stats.byMember.reduce((total, member) => total + member.paidCents, 0)
    ).toBe(stats.totalCents);
  });

  it("returns a zeroed result for an empty group", () => {
    expect(computeGroupStats([], [], [])).toEqual({
      periodStart: new Date(0),
      periodEnd: new Date(0),
      totalCents: 0,
      expenseCount: 0,
      memberCount: 0,
      byCategory: [],
      byMonth: [],
      byMember: [],
      avgExpenseCents: 0,
      largestExpense: {
        id: "",
        description: "",
        cents: 0,
        date: new Date(0),
      },
      activeDays: 0,
      settlementCount: 0,
    });
  });
});
