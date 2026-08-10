export interface RelationshipExpense {
  id: string;
  amountCents: number;
  paidBy: string;
  date: Date | string;
  category: string;
  shares: Record<string, number>;
}

export interface RelationshipSettlement {
  fromMemberId: string;
  toMemberId: string;
  confirmedAt: Date | string;
}

export interface RelationshipStats {
  firstSharedExpenseAt: Date;
  sharedExpenseCount: number;
  totalSharedCents: number;
  aPaidCount: number;
  bPaidCount: number;
  aPaidCents: number;
  bPaidCents: number;
  aBurdenRatio: number;
  bBurdenRatio: number;
  avgSettleDays: number;
  settledExpenseCount: number;
  topCategories: Array<{ category: string; cents: number; count: number }>;
  monthlyTrend: Array<{ month: string; aCents: number; bCents: number }>;
}

const DAY_MS = 24 * 60 * 60 * 1_000;

function asValidDate(value: Date | string) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function computeRelationship(
  expenses: RelationshipExpense[],
  settlements: RelationshipSettlement[],
  memberA: string,
  memberB: string
): RelationshipStats {
  const sharedExpenses = expenses
    .flatMap((expense) => {
      const date = asValidDate(expense.date);
      if (
        !date ||
        !Object.hasOwn(expense.shares, memberA) ||
        !Object.hasOwn(expense.shares, memberB)
      ) {
        return [];
      }
      return [{ expense, date }];
    })
    .sort((left, right) => left.date.getTime() - right.date.getTime());

  if (sharedExpenses.length === 0) {
    return {
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
    };
  }

  let totalSharedCents = 0;
  let aPaidCount = 0;
  let bPaidCount = 0;
  let aPaidCents = 0;
  let bPaidCents = 0;
  let aBurdenCents = 0;
  let bBurdenCents = 0;
  const categoryTotals = new Map<string, { cents: number; count: number }>();
  const monthlyTotals = new Map<string, { aCents: number; bCents: number }>();

  for (const { expense, date } of sharedExpenses) {
    totalSharedCents += expense.amountCents;
    if (expense.paidBy === memberA) {
      aPaidCount += 1;
      aPaidCents += expense.amountCents;
    } else if (expense.paidBy === memberB) {
      bPaidCount += 1;
      bPaidCents += expense.amountCents;
    }

    const aShare = expense.shares[memberA] ?? 0;
    const bShare = expense.shares[memberB] ?? 0;
    aBurdenCents += aShare;
    bBurdenCents += bShare;

    const category = categoryTotals.get(expense.category) ?? { cents: 0, count: 0 };
    category.cents += expense.amountCents;
    category.count += 1;
    categoryTotals.set(expense.category, category);

    const month = monthKey(date);
    const monthly = monthlyTotals.get(month) ?? { aCents: 0, bCents: 0 };
    monthly.aCents += aShare;
    monthly.bCents += bShare;
    monthlyTotals.set(month, monthly);
  }

  const burdenTotalCents = aBurdenCents + bBurdenCents;
  const aBurdenRatio = burdenTotalCents > 0 ? aBurdenCents / burdenTotalCents : 0;
  const bBurdenRatio = burdenTotalCents > 0 ? 1 - aBurdenRatio : 0;

  const pairSettlementDates = settlements
    .flatMap((settlement) => {
      const isPair =
        (settlement.fromMemberId === memberA && settlement.toMemberId === memberB) ||
        (settlement.fromMemberId === memberB && settlement.toMemberId === memberA);
      const date = isPair ? asValidDate(settlement.confirmedAt) : null;
      return date ? [date] : [];
    })
    .sort((left, right) => left.getTime() - right.getTime());

  let settledExpenseCount = 0;
  let settleDaysTotal = 0;
  for (const { date } of sharedExpenses) {
    const settlementDate = pairSettlementDates.find(
      (candidate) => candidate.getTime() >= date.getTime()
    );
    if (!settlementDate) continue;
    settledExpenseCount += 1;
    settleDaysTotal += (settlementDate.getTime() - date.getTime()) / DAY_MS;
  }

  const firstMonth = new Date(
    Date.UTC(
      sharedExpenses[0].date.getUTCFullYear(),
      sharedExpenses[0].date.getUTCMonth(),
      1
    )
  );
  const lastSharedDate = sharedExpenses[sharedExpenses.length - 1].date;
  const lastMonth = new Date(
    Date.UTC(lastSharedDate.getUTCFullYear(), lastSharedDate.getUTCMonth(), 1)
  );
  const monthlyTrend: RelationshipStats["monthlyTrend"] = [];
  for (
    const cursor = new Date(firstMonth);
    cursor.getTime() <= lastMonth.getTime();
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  ) {
    const month = monthKey(cursor);
    monthlyTrend.push({
      month,
      ...(monthlyTotals.get(month) ?? { aCents: 0, bCents: 0 }),
    });
  }

  return {
    firstSharedExpenseAt: new Date(sharedExpenses[0].date.getTime()),
    sharedExpenseCount: sharedExpenses.length,
    totalSharedCents,
    aPaidCount,
    bPaidCount,
    aPaidCents,
    bPaidCents,
    aBurdenRatio,
    bBurdenRatio,
    avgSettleDays:
      settledExpenseCount > 0 ? settleDaysTotal / settledExpenseCount : 0,
    settledExpenseCount,
    topCategories: [...categoryTotals]
      .map(([category, totals]) => ({ category, ...totals }))
      .sort(
        (left, right) =>
          right.cents - left.cents ||
          right.count - left.count ||
          left.category.localeCompare(right.category, "zh-CN")
      )
      .slice(0, 3),
    monthlyTrend,
  };
}
