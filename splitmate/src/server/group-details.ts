import { getGroupBalances, type MemberBalance } from "@/server/balances";
import { openDatabase } from "@/server/database";
import type { GroupMemberSummary } from "@/server/groups";
import type { Currency } from "@/lib/currency";
import type { ExpenseCategory } from "@/lib/expense-input";
import { getExportSummaryData, type ExportSummaryData } from "@/server/export-summary";

export interface GroupExpenseSummary {
  id: string;
  description: string;
  amountCents: number;
  date: string;
  paidByMemberId: string;
  paidByName: string;
  category: ExpenseCategory;
  settled: boolean;
  shares: Array<{ memberId: string; amountCents: number }>;
}

export interface GroupDetailData {
  id: string;
  name: string;
  currency: Currency;
  members: GroupMemberSummary[];
  balances: MemberBalance[];
  expenses: GroupExpenseSummary[];
  exportSummary: ExportSummaryData;
}

interface GroupRow {
  id: string;
  name: string;
  currency: Currency;
}

type MemberRow = GroupMemberSummary;

interface ExpenseRow {
  id: string;
  description: string;
  amountCents: number;
  date: number | string;
  paidByMemberId: string;
  paidByName: string;
  category: ExpenseCategory;
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
      .prepare(`SELECT id, name, currency FROM "Group" WHERE id = ?`)
      .get(groupId) as GroupRow | undefined;
    if (!group) return null;

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
                expense.category,
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

    const exportSummary = getExportSummaryData(groupId);
    if (!exportSummary) return null;

    return {
      id: group.id,
      name: group.name,
      currency: group.currency,
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
        category: expense.category,
        settled: Boolean(expense.settled),
        shares: sharesByExpense.get(expense.id) ?? [],
      })),
      exportSummary,
    };
  } finally {
    database.close();
  }
}
