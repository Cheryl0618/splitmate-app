import { computeNetBalances, type Expense, type Transfer } from "./settlement";

interface PairBalance {
  first: string;
  second: string;
  firstOwesSecondCents: number;
}

export function computeDirectDebts(expenses: Expense[]): Transfer[] {
  computeNetBalances(expenses);

  const pairs = new Map<string, PairBalance>();
  for (const expense of expenses) {
    if (expense.settled) continue;

    for (const [memberId, amountCents] of Object.entries(expense.shares)) {
      if (memberId === expense.paidBy || amountCents === 0) continue;

      const [first, second] = [memberId, expense.paidBy].sort();
      const key = JSON.stringify([first, second]);
      const pair = pairs.get(key) ?? {
        first,
        second,
        firstOwesSecondCents: 0,
      };
      pair.firstOwesSecondCents +=
        memberId === first ? amountCents : -amountCents;
      pairs.set(key, pair);
    }
  }

  return [...pairs.values()].flatMap((pair) => {
    if (pair.firstOwesSecondCents > 0) {
      return [
        {
          from: pair.first,
          to: pair.second,
          amountCents: pair.firstOwesSecondCents,
        },
      ];
    }
    if (pair.firstOwesSecondCents < 0) {
      return [
        {
          from: pair.second,
          to: pair.first,
          amountCents: -pair.firstOwesSecondCents,
        },
      ];
    }
    return [];
  });
}
