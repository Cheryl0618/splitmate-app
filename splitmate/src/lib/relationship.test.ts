import { describe, expect, it } from "vitest";

import { homeGroupSeed } from "./seed-data";
import { computeRelationship } from "./relationship";

const memberA = "member-home-xiaoli";
const memberB = "member-home-xiaowang";

describe("computeRelationship", () => {
  it("uses the full amount of every expense both members joined", () => {
    const expectedTotal = homeGroupSeed.expenses
      .filter(
        (expense) =>
          Object.hasOwn(expense.shares, memberA) &&
          Object.hasOwn(expense.shares, memberB)
      )
      .reduce((total, expense) => total + expense.amountCents, 0);

    const stats = computeRelationship(
      homeGroupSeed.expenses,
      homeGroupSeed.settlements,
      memberA,
      memberB
    );

    expect(stats.totalSharedCents).toBe(expectedTotal);
  });

  it("returns complementary burden ratios", () => {
    const stats = computeRelationship(
      homeGroupSeed.expenses,
      homeGroupSeed.settlements,
      memberA,
      memberB
    );

    expect(stats.aBurdenRatio + stats.bBurdenRatio).toBe(1);
  });

  it("does not count a third-party payer as either member", () => {
    const stats = computeRelationship(
      homeGroupSeed.expenses,
      homeGroupSeed.settlements,
      memberA,
      memberB
    );

    expect(stats.aPaidCount + stats.bPaidCount).toBeLessThanOrEqual(
      stats.sharedExpenseCount
    );
  });

  it("returns zeroed statistics when there are no shared expenses", () => {
    const stats = computeRelationship(
      homeGroupSeed.expenses,
      homeGroupSeed.settlements,
      "member-without-expenses-a",
      "member-without-expenses-b"
    );

    expect(stats).toEqual({
      firstSharedExpenseAt: new Date(0),
      sharedExpenseCount: 0,
      totalSharedCents: 0,
      aPaidCount: 0,
      bPaidCount: 0,
      aPaidCents: 0,
      bPaidCents: 0,
      aBurdenRatio: 0,
      bBurdenRatio: 0,
      avgSettleDays: 0,
      settledExpenseCount: 0,
      topCategories: [],
      monthlyTrend: [],
    });
  });

  it("matches each expense to the first later settlement for this pair", () => {
    const stats = computeRelationship(
      [
        {
          id: "one",
          amountCents: 1_000,
          paidBy: memberA,
          date: "2026-01-01T12:00:00.000Z",
          category: "餐饮",
          shares: { [memberA]: 500, [memberB]: 500 },
        },
        {
          id: "two",
          amountCents: 2_000,
          paidBy: memberB,
          date: "2026-01-03T12:00:00.000Z",
          category: "餐饮",
          shares: { [memberA]: 1_000, [memberB]: 1_000 },
        },
      ],
      [
        {
          fromMemberId: memberA,
          toMemberId: "third-member",
          confirmedAt: "2026-01-04T12:00:00.000Z",
        },
        {
          fromMemberId: memberB,
          toMemberId: memberA,
          confirmedAt: "2026-01-06T12:00:00.000Z",
        },
      ],
      memberA,
      memberB
    );

    expect(stats.settledExpenseCount).toBe(2);
    expect(stats.avgSettleDays).toBe(4);
  });
});
