import { describe, expect, it } from "vitest";

import { homeGroupSeed } from "./seed-data";
import { computeDirectDebts } from "./direct-debts";
import { computeNetBalances, optimalSettle, type Expense } from "./settlement";

function homeExpenses(): Expense[] {
  return homeGroupSeed.expenses.map((expense) => ({
    id: expense.id,
    amountCents: expense.amountCents,
    paidBy: expense.paidBy,
    shares: expense.shares,
  }));
}

function balancesFromTransfers(
  transfers: Array<{ from: string; to: string; amountCents: number }>
) {
  const balances = new Map<string, number>();
  for (const transfer of transfers) {
    balances.set(
      transfer.from,
      (balances.get(transfer.from) ?? 0) - transfer.amountCents
    );
    balances.set(
      transfer.to,
      (balances.get(transfer.to) ?? 0) + transfer.amountCents
    );
  }
  for (const [memberId, amountCents] of balances) {
    if (amountCents === 0) balances.delete(memberId);
  }
  return balances;
}

describe("computeDirectDebts", () => {
  it("nets opposite debts only within the same pair", () => {
    const debts = computeDirectDebts([
      { id: "A-paid", amountCents: 5_000, paidBy: "A", shares: { B: 5_000 } },
      { id: "B-paid", amountCents: 2_000, paidBy: "B", shares: { A: 2_000 } },
    ]);

    expect(debts).toEqual([{ from: "B", to: "A", amountCents: 3_000 }]);
  });

  it("needs more transfers than optimal settlement for the home seed", () => {
    const expenses = homeExpenses();

    expect(computeDirectDebts(expenses).length).toBeGreaterThan(
      optimalSettle(computeNetBalances(expenses)).length
    );
  });

  it("aggregates to the same balances as computeNetBalances", () => {
    const expenses = homeExpenses();

    expect(balancesFromTransfers(computeDirectDebts(expenses))).toEqual(
      computeNetBalances(expenses)
    );
  });
});
