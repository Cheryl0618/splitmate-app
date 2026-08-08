import { describe, expect, it } from "vitest";

import {
  computeNetBalances,
  greedySettle,
  optimalSettle,
  splitByWeights,
  splitEqually,
  type Expense,
} from "./settlement";

describe("splitEqually", () => {
  it("distributes indivisible cents without changing the total", () => {
    const result = splitEqually(100, 3);

    expect(result).toEqual([34, 33, 33]);
    expect(result.reduce((sum, share) => sum + share, 0)).toBe(100);
  });
});

describe("splitByWeights", () => {
  it("preserves the total across randomized positive weights", () => {
    let state = 0x5eed1234;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 0x1_0000_0000;
    };

    for (let run = 0; run < 100; run++) {
      const total = 1 + Math.floor(random() * 1_000_000);
      const memberCount = 1 + Math.floor(random() * 12);
      const weights = Array.from(
        { length: memberCount },
        () => 1 + Math.floor(random() * 1_000)
      );

      const shares = splitByWeights(total, weights);

      expect(shares.reduce((sum, share) => sum + share, 0)).toBe(total);
    }
  });
});

describe("computeNetBalances", () => {
  it("cancels circular debt into net balances", () => {
    const expenses: Expense[] = [
      { id: "A-to-B", amountCents: 2_000, paidBy: "B", shares: { A: 2_000 } },
      { id: "B-to-C", amountCents: 5_000, paidBy: "C", shares: { B: 5_000 } },
      { id: "C-to-D", amountCents: 3_000, paidBy: "D", shares: { C: 3_000 } },
      { id: "D-to-A", amountCents: 4_000, paidBy: "A", shares: { D: 4_000 } },
    ];

    expect(Object.fromEntries(computeNetBalances(expenses))).toEqual({
      A: 2_000,
      B: -3_000,
      C: 2_000,
      D: -1_000,
    });
  });

  it("rejects an expense whose shares do not add up to its amount", () => {
    const invalidExpense: Expense = {
      id: "invalid",
      amountCents: 1_000,
      paidBy: "A",
      shares: { A: 400, B: 500 },
    };

    expect(() => computeNetBalances([invalidExpense])).toThrow(
      "expense invalid: shares sum to 900, expected 1000"
    );
  });
});

describe("settlement strategies", () => {
  it("uses three optimal transfers where greedy needs four", () => {
    const balances = new Map([
      ["A", 10],
      ["B", -6],
      ["C", -4],
      ["D", 6],
      ["E", -6],
    ]);

    expect(optimalSettle(balances)).toHaveLength(3);
    expect(greedySettle(balances)).toHaveLength(4);
  });
});
