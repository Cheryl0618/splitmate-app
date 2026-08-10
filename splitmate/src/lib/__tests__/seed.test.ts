import { describe, expect, it } from "vitest";

import { homeGroupSeed } from "../seed-data";
import { computeNetBalances, greedySettle, optimalSettle } from "../settlement";

const homeBalances = () =>
  computeNetBalances(
    homeGroupSeed.expenses.map((expense) => ({
      id: expense.id,
      amountCents: expense.amountCents,
      paidBy: expense.paidBy,
      shares: expense.shares,
    }))
  );

describe("home group seed data", () => {
  it("produces the exact demo balances", () => {
    const balances = homeBalances();
    const balancesByName = Object.fromEntries(
      homeGroupSeed.members.map((member) => [
        member.displayName,
        balances.get(member.id) ?? 0,
      ])
    );

    expect(balancesByName).toEqual({
      小李: 10_000,
      小王: -6_000,
      Lucy: -4_000,
      Tom: 6_000,
      Emma: -6_000,
    });
  });

  it("needs four greedy transfers but only three optimal transfers", () => {
    const balances = homeBalances();

    expect(greedySettle(balances)).toHaveLength(4);
    expect(optimalSettle(balances)).toHaveLength(3);
  });

  it("covers one year with dense, deliberately uneven demo activity", () => {
    const months = new Set(homeGroupSeed.expenses.map((expense) => expense.date.slice(0, 7)));
    const payerCounts = homeGroupSeed.expenses.reduce<Record<string, number>>(
      (counts, expense) => ({
        ...counts,
        [expense.paidBy]: (counts[expense.paidBy] ?? 0) + 1,
      }),
      {}
    );
    const categoryTotals = homeGroupSeed.expenses.reduce<Record<string, number>>(
      (totals, expense) => ({
        ...totals,
        [expense.category]: (totals[expense.category] ?? 0) + expense.amountCents,
      }),
      {}
    );

    expect(homeGroupSeed.expenses.length).toBeGreaterThanOrEqual(100);
    expect(homeGroupSeed.expenses.length).toBeLessThanOrEqual(130);
    expect(homeGroupSeed.settlements.length).toBeGreaterThanOrEqual(30);
    expect(homeGroupSeed.settlements.length).toBeLessThanOrEqual(40);
    expect(months.size).toBe(12);
    expect(payerCounts["member-home-xiaoli"]).toBeGreaterThan(
      payerCounts["member-home-xiaowang"]
    );
    expect(payerCounts["member-home-tom"]).toBeGreaterThan(
      payerCounts["member-home-lucy"]
    );
    expect(categoryTotals["住宿"]).toBeGreaterThan(categoryTotals["超市"] * 5);
  });
});
