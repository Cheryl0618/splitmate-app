import {
  computeRelationship,
  type RelationshipExpense,
  type RelationshipStats,
} from "@/lib/relationship";
import { openDatabase } from "@/server/database";

export interface RelationshipInsightStats {
  stats: RelationshipStats;
  scopeId: string;
}

export function getRelationshipInsightStats(
  groupId: string,
  targetMemberId: string,
  currentUserId: string
): RelationshipInsightStats | null {
  const database = openDatabase();
  try {
    const members = database
      .prepare(`SELECT id, userId FROM "GroupMember" WHERE groupId = ?`)
      .all(groupId) as Array<{ id: string; userId: string | null }>;
    const target = members.find((member) => member.id === targetMemberId);
    const current = members.find((member) => member.userId === currentUserId);
    if (!target || !current || target.id === current.id) return null;

    const expenseRows = database
      .prepare(
        `SELECT id, amountCents, paidBy, date, category
         FROM "Expense" WHERE groupId = ? ORDER BY date, createdAt, id`
      )
      .all(groupId) as Array<{
        id: string;
        amountCents: number;
        paidBy: string;
        date: number | string;
        category: string;
      }>;
    const shareRows = database
      .prepare(
        `SELECT share.expenseId, share.memberId, share.amountCents
         FROM "ExpenseShare" AS share
         INNER JOIN "Expense" AS expense ON expense.id = share.expenseId
         WHERE expense.groupId = ?`
      )
      .all(groupId) as Array<{
        expenseId: string;
        memberId: string;
        amountCents: number;
      }>;
    const settlementRows = database
      .prepare(
        `SELECT fromMemberId, toMemberId, confirmedAt
         FROM "Settlement" WHERE groupId = ? ORDER BY confirmedAt, id`
      )
      .all(groupId) as Array<{
        fromMemberId: string;
        toMemberId: string;
        confirmedAt: number | string;
      }>;

    const sharesByExpense = new Map<string, Record<string, number>>();
    for (const share of shareRows) {
      const shares = sharesByExpense.get(share.expenseId) ?? {};
      shares[share.memberId] = share.amountCents;
      sharesByExpense.set(share.expenseId, shares);
    }
    const expenses: RelationshipExpense[] = expenseRows.map((expense) => ({
      ...expense,
      date: new Date(expense.date).toISOString(),
      shares: sharesByExpense.get(expense.id) ?? {},
    }));
    const stats = computeRelationship(
      expenses,
      settlementRows.map((settlement) => ({
        ...settlement,
        confirmedAt: new Date(settlement.confirmedAt).toISOString(),
      })),
      current.id,
      target.id
    );

    return {
      stats,
      scopeId: `${groupId}:${[current.id, target.id].sort().join(":")}`,
    };
  } finally {
    database.close();
  }
}
