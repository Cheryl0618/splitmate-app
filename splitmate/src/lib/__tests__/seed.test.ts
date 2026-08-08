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
});
