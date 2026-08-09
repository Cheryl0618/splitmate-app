import { getGroupBalances, type MemberBalance } from "@/server/balances";
import { openDatabase } from "@/server/database";
import type { DemoUserSummary, GroupMemberSummary } from "@/server/groups";

export interface GroupExpenseSummary {
  id: string;
  description: string;
  amountCents: number;
  date: string;
  paidByMemberId: string;
  paidByName: string;
  settled: boolean;
  shares: Array<{ memberId: string; amountCents: number }>;
}

export interface GroupDetailData {
  id: string;
  name: string;
  users: DemoUserSummary[];
  members: GroupMemberSummary[];
  balances: MemberBalance[];
  expenses: GroupExpenseSummary[];
}

interface GroupRow {
  id: string;
  name: string;
}

type MemberRow = GroupMemberSummary;

interface ExpenseRow {
  id: string;
  description: string;
  amountCents: number;
  date: number | string;
  paidByMemberId: string;
  paidByName: string;
  settled: number;
}

interface ShareRow {
  expenseId: string;
  memberId: string;
  amountCents: number;
}

export function getGroupDetail(groupId: string): GroupDetailData | null {
  const database = openDatabase();

  try {
    const group = database
      .prepare(`SELECT id, name FROM "Group" WHERE id = ?`)
      .get(groupId) as GroupRow | undefined;
    if (!group) return null;

    const userRows = database
      .prepare(`SELECT id, displayName FROM "User" ORDER BY createdAt, id`)
      .all() as DemoUserSummary[];
    const memberRows = database
      .prepare(
        `SELECT id, userId, displayName
         FROM "GroupMember"
         WHERE groupId = ?
         ORDER BY createdAt, id`
      )
      .all(groupId) as MemberRow[];
    const expenseRows = database
      .prepare(
        `SELECT expense.id,
                expense.description,
                expense.amountCents,
                expense.date,
                expense.paidBy AS paidByMemberId,
                expense.settled,
                payer.displayName AS paidByName
         FROM "Expense" AS expense
         INNER JOIN "GroupMember" AS payer ON payer.id = expense.paidBy
         WHERE expense.groupId = ?
         ORDER BY expense.date DESC, expense.createdAt DESC, expense.id`
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

    const sharesByExpense = new Map<
      string,
      Array<{ memberId: string; amountCents: number }>
    >();
    for (const share of shareRows) {
      const shares = sharesByExpense.get(share.expenseId) ?? [];
      shares.push({ memberId: share.memberId, amountCents: share.amountCents });
      sharesByExpense.set(share.expenseId, shares);
    }

    return {
      id: group.id,
      name: group.name,
      users: userRows.map(({ id, displayName }) => ({ id, displayName })),
      members: memberRows.map(({ id, userId, displayName }) => ({
        id,
        userId,
        displayName,
      })),
      balances: getGroupBalances(groupId),
      expenses: expenseRows.map((expense) => ({
        id: expense.id,
        description: expense.description,
        amountCents: expense.amountCents,
        date: new Date(expense.date).toISOString(),
        paidByMemberId: expense.paidByMemberId,
        paidByName: expense.paidByName,
        settled: Boolean(expense.settled),
        shares: sharesByExpense.get(expense.id) ?? [],
      })),
    };
  } finally {
    database.close();
  }
}
