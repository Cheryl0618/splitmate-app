import {
  computeGroupStats,
  type GroupStats,
  type GroupStatsExpense,
} from "@/lib/group-stats";
import { openDatabase } from "@/server/database";

interface ExpenseRow {
  id: string;
  description: string;
  amountCents: number;
  paidBy: string;
  date: number | string;
  category: string;
}

interface ShareRow {
  expenseId: string;
  memberId: string;
  amountCents: number;
}

export function getGroupStats(groupId: string): GroupStats | null {
  const database = openDatabase();
  try {
    const group = database
      .prepare(`SELECT id FROM "Group" WHERE id = ?`)
      .get(groupId) as { id: string } | undefined;
    if (!group) return null;

    const members = database
      .prepare(`SELECT id FROM "GroupMember" WHERE groupId = ? ORDER BY createdAt, id`)
      .all(groupId) as Array<{ id: string }>;
    const expenses = database
      .prepare(
        `SELECT id, description, amountCents, paidBy, date, category
         FROM "Expense"
         WHERE groupId = ?
         ORDER BY date, createdAt, id`
      )
      .all(groupId) as ExpenseRow[];
    const shares = database
      .prepare(
        `SELECT share.expenseId, share.memberId, share.amountCents
         FROM "ExpenseShare" AS share
         INNER JOIN "Expense" AS expense ON expense.id = share.expenseId
         WHERE expense.groupId = ?`
      )
      .all(groupId) as ShareRow[];
    const settlements = database
      .prepare(
        `SELECT confirmedAt
         FROM "Settlement"
         WHERE groupId = ?
         ORDER BY confirmedAt, id`
      )
      .all(groupId) as Array<{ confirmedAt: number | string }>;

    const sharesByExpense = new Map<string, Record<string, number>>();
    for (const share of shares) {
      const expenseShares = sharesByExpense.get(share.expenseId) ?? {};
      expenseShares[share.memberId] = share.amountCents;
      sharesByExpense.set(share.expenseId, expenseShares);
    }

    const mappedExpenses: GroupStatsExpense[] = expenses.map((expense) => ({
      ...expense,
      date: new Date(expense.date).toISOString(),
      shares: sharesByExpense.get(expense.id) ?? {},
    }));
    return computeGroupStats(
      mappedExpenses,
      settlements.map((settlement) => ({
        confirmedAt: new Date(settlement.confirmedAt).toISOString(),
      })),
      members
    );
  } finally {
    database.close();
  }
}
