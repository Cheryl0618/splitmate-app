import type {
  RelationshipExpense,
  RelationshipSettlement,
} from "@/lib/relationship";
import { openDatabase } from "@/server/database";
import type { DemoUserSummary } from "@/server/groups";

export interface RelationshipMember {
  id: string;
  userId: string | null;
  displayName: string;
}

export interface RelationshipPageData {
  group: { id: string; name: string };
  targetMember: RelationshipMember;
  members: RelationshipMember[];
  users: DemoUserSummary[];
  expenses: RelationshipExpense[];
  settlements: RelationshipSettlement[];
}

interface ExpenseRow {
  id: string;
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

interface SettlementRow {
  fromMemberId: string;
  toMemberId: string;
  confirmedAt: number | string;
}

export function getRelationshipPageData(
  groupId: string,
  memberId: string
): RelationshipPageData | null {
  const database = openDatabase();

  try {
    const group = database
      .prepare(`SELECT id, name FROM "Group" WHERE id = ?`)
      .get(groupId) as { id: string; name: string } | undefined;
    if (!group) return null;

    const members = database
      .prepare(
        `SELECT id, userId, displayName
         FROM "GroupMember"
         WHERE groupId = ?
         ORDER BY createdAt, id`
      )
      .all(groupId) as RelationshipMember[];
    const targetMember = members.find((member) => member.id === memberId);
    if (!targetMember) return null;

    const users = database
      .prepare(`SELECT id, displayName FROM "User" ORDER BY createdAt, id`)
      .all() as DemoUserSummary[];
    const expenseRows = database
      .prepare(
        `SELECT id, amountCents, paidBy, date, category
         FROM "Expense"
         WHERE groupId = ?
         ORDER BY date, createdAt, id`
      )
      .all(groupId) as ExpenseRow[];
    const shareRows = database
      .prepare(
        `SELECT share.expenseId, share.memberId, share.amountCents
         FROM "ExpenseShare" AS share
         INNER JOIN "Expense" AS expense ON expense.id = share.expenseId
         WHERE expense.groupId = ?`
      )
      .all(groupId) as ShareRow[];
    const settlementRows = database
      .prepare(
        `SELECT fromMemberId, toMemberId, confirmedAt
         FROM "Settlement"
         WHERE groupId = ?
         ORDER BY confirmedAt, id`
      )
      .all(groupId) as SettlementRow[];

    const sharesByExpense = new Map<string, Record<string, number>>();
    for (const share of shareRows) {
      const shares = sharesByExpense.get(share.expenseId) ?? {};
      shares[share.memberId] = share.amountCents;
      sharesByExpense.set(share.expenseId, shares);
    }

    return {
      group,
      targetMember,
      members: members.map(({ id, userId, displayName }) => ({
        id,
        userId,
        displayName,
      })),
      users: users.map(({ id, displayName }) => ({ id, displayName })),
      expenses: expenseRows.map((expense) => ({
        id: expense.id,
        amountCents: expense.amountCents,
        paidBy: expense.paidBy,
        date: new Date(expense.date).toISOString(),
        category: expense.category,
        shares: sharesByExpense.get(expense.id) ?? {},
      })),
      settlements: settlementRows.map((settlement) => ({
        fromMemberId: settlement.fromMemberId,
        toMemberId: settlement.toMemberId,
        confirmedAt: new Date(settlement.confirmedAt).toISOString(),
      })),
    };
  } finally {
    database.close();
  }
}
