export interface GroupStatsExpense {
  id: string;
  description: string;
  amountCents: number;
  paidBy: string;
  date: Date | string;
  category: string;
  shares: Record<string, number>;
}

export interface GroupStatsSettlement {
  confirmedAt: Date | string;
}

export interface GroupStatsMember {
  id: string;
}

export interface GroupStats {
  periodStart: Date;
  periodEnd: Date;
  totalCents: number;
  expenseCount: number;
  memberCount: number;
  byCategory: Array<{
    category: string;
    cents: number;
    count: number;
    share: number;
  }>;
  byMonth: Array<{ month: string; cents: number; count: number }>;
  byMember: Array<{
    memberId: string;
    paidCents: number;
    burdenCents: number;
    paidCount: number;
  }>;
  avgExpenseCents: number;
  largestExpense: {
    id: string;
    description: string;
    cents: number;
    date: Date;
  };
  activeDays: number;
  settlementCount: number;
}

function validDate(value: Date | string) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function computeGroupStats(
  expenses: GroupStatsExpense[],
  settlements: GroupStatsSettlement[],
  members: GroupStatsMember[]
): GroupStats {
  const datedExpenses = expenses
    .flatMap((expense) => {
      const date = validDate(expense.date);
      return date ? [{ expense, date }] : [];
    })
    .sort((left, right) => left.date.getTime() - right.date.getTime());
  const emptyDate = new Date(0);
  const periodStart = datedExpenses[0]?.date ?? emptyDate;
  const periodEnd = datedExpenses.at(-1)?.date ?? emptyDate;
  const totalCents = datedExpenses.reduce(
    (total, { expense }) => total + expense.amountCents,
    0
  );

  const categoryTotals = new Map<string, { cents: number; count: number }>();
  const monthTotals = new Map<string, { cents: number; count: number }>();
  const memberTotals = new Map(
    members.map((member) => [
      member.id,
      { memberId: member.id, paidCents: 0, burdenCents: 0, paidCount: 0 },
    ])
  );
  const activeDays = new Set<string>();
  let largest = datedExpenses[0];

  for (const entry of datedExpenses) {
    const { expense, date } = entry;
    const category = categoryTotals.get(expense.category) ?? {
      cents: 0,
      count: 0,
    };
    category.cents += expense.amountCents;
    category.count += 1;
    categoryTotals.set(expense.category, category);

    const month = monthKey(date);
    const monthly = monthTotals.get(month) ?? { cents: 0, count: 0 };
    monthly.cents += expense.amountCents;
    monthly.count += 1;
    monthTotals.set(month, monthly);
    activeDays.add(date.toISOString().slice(0, 10));

    const payer = memberTotals.get(expense.paidBy);
    if (payer) {
      payer.paidCents += expense.amountCents;
      payer.paidCount += 1;
    }
    for (const [memberId, amountCents] of Object.entries(expense.shares)) {
      const member = memberTotals.get(memberId);
      if (member) member.burdenCents += amountCents;
    }

    if (!largest || expense.amountCents > largest.expense.amountCents) {
      largest = entry;
    }
  }

  const byMonth: GroupStats["byMonth"] = [];
  if (datedExpenses.length > 0) {
    const cursor = new Date(
      Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth(), 1)
    );
    const lastMonth = new Date(
      Date.UTC(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth(), 1)
    );
    while (cursor.getTime() <= lastMonth.getTime()) {
      const month = monthKey(cursor);
      byMonth.push({
        month,
        ...(monthTotals.get(month) ?? { cents: 0, count: 0 }),
      });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }

  const settlementCount =
    datedExpenses.length === 0
      ? 0
      : settlements.filter((settlement) => {
          const date = validDate(settlement.confirmedAt);
          return (
            date !== null &&
            date.getTime() >= periodStart.getTime() &&
            date.getTime() <= periodEnd.getTime()
          );
        }).length;

  return {
    periodStart: new Date(periodStart.getTime()),
    periodEnd: new Date(periodEnd.getTime()),
    totalCents,
    expenseCount: datedExpenses.length,
    memberCount: members.length,
    byCategory: [...categoryTotals]
      .map(([category, totals]) => ({
        category,
        cents: totals.cents,
        count: totals.count,
        share: totalCents > 0 ? totals.cents / totalCents : 0,
      }))
      .sort(
        (left, right) =>
          right.cents - left.cents ||
          left.category.localeCompare(right.category, "zh-CN")
      ),
    byMonth,
    byMember: [...memberTotals.values()].map((member) => ({ ...member })),
    avgExpenseCents:
      datedExpenses.length > 0
        ? Math.round(totalCents / datedExpenses.length)
        : 0,
    largestExpense: largest
      ? {
          id: largest.expense.id,
          description: largest.expense.description,
          cents: largest.expense.amountCents,
          date: new Date(largest.date.getTime()),
        }
      : { id: "", description: "", cents: 0, date: new Date(0) },
    activeDays: activeDays.size,
    settlementCount,
  };
}
