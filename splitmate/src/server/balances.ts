import { computeNetBalances, type Expense } from "@/lib/settlement";
import { openDatabase } from "@/server/database";

export interface MemberBalance {
  memberId: string;
  userId: string | null;
  displayName: string;
  amountCents: number;
}

interface MemberRow {
  id: string;
  userId: string | null;
  displayName: string;
}

interface ExpenseRow {
  id: string;
  amountCents: number;
  paidBy: string;
}

interface ShareRow {
  expenseId: string;
  memberId: string;
  amountCents: number;
}

interface SettlementRow {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  amountCents: number;
}

export function getGroupBalances(groupId: string): MemberBalance[] {
  const database = openDatabase();

  try {
    const members = database
      .prepare(
        `SELECT id, userId, displayName
         FROM "GroupMember"
         WHERE groupId = ?
         ORDER BY createdAt, id`
      )
      .all(groupId) as MemberRow[];
    const expenseRows = database
      .prepare(
        `SELECT id, amountCents, paidBy
         FROM "Expense"
         WHERE groupId = ? AND settled = 0`
      )
      .all(groupId) as ExpenseRow[];
    const shareRows = database
      .prepare(
        `SELECT share.expenseId, share.memberId, share.amountCents
         FROM "ExpenseShare" AS share
         INNER JOIN "Expense" AS expense ON expense.id = share.expenseId
         WHERE expense.groupId = ? AND expense.settled = 0`
      )
      .all(groupId) as ShareRow[];
    const settlements = database
      .prepare(
        `SELECT id, fromMemberId, toMemberId, amountCents
         FROM "Settlement"
         WHERE groupId = ?`
      )
      .all(groupId) as SettlementRow[];

    const sharesByExpense = new Map<string, Record<string, number>>();
    for (const share of shareRows) {
      const shares = sharesByExpense.get(share.expenseId) ?? {};
      shares[share.memberId] = share.amountCents;
      sharesByExpense.set(share.expenseId, shares);
    }

    const expenses: Expense[] = expenseRows.map((expense) => ({
      id: expense.id,
      amountCents: expense.amountCents,
      paidBy: expense.paidBy,
      shares: sharesByExpense.get(expense.id) ?? {},
    }));

    for (const settlement of settlements) {
      expenses.push({
        id: `settlement:${settlement.id}`,
        amountCents: settlement.amountCents,
        paidBy: settlement.fromMemberId,
        shares: { [settlement.toMemberId]: settlement.amountCents },
      });
    }

    const balances = computeNetBalances(expenses);
    return members.map((member) => ({
      memberId: member.id,
      userId: member.userId,
      displayName: member.displayName,
      amountCents: balances.get(member.id) ?? 0,
    }));
  } finally {
    database.close();
  }
}
