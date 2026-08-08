import { computeNetBalances, type Expense } from "@/lib/settlement";
import { openDatabase } from "@/server/database";

export interface DemoUserSummary {
  id: string;
  displayName: string;
}

export interface GroupMemberSummary {
  id: string;
  userId: string | null;
  displayName: string;
}

export interface GroupCardData {
  id: string;
  name: string;
  members: GroupMemberSummary[];
  balancesByUserId: Record<string, number>;
}

interface GroupRow {
  id: string;
  name: string;
}

interface MemberRow extends GroupMemberSummary {
  groupId: string;
}

interface ExpenseRow {
  id: string;
  groupId: string;
  amountCents: number;
  paidBy: string;
  settled: number;
}

interface ShareRow {
  expenseId: string;
  memberId: string;
  amountCents: number;
}

interface SettlementRow {
  id: string;
  groupId: string;
  fromMemberId: string;
  toMemberId: string;
  amountCents: number;
}

export function getGroupListData(): {
  users: DemoUserSummary[];
  groups: GroupCardData[];
} {
  const database = openDatabase();

  try {
    const userRows = database
      .prepare(`SELECT id, displayName FROM "User" ORDER BY createdAt, id`)
      .all() as DemoUserSummary[];
    const groupRows = database
      .prepare(`SELECT id, name FROM "Group" ORDER BY createdAt, id`)
      .all() as GroupRow[];
    const memberRows = database
      .prepare(
        `SELECT id, groupId, userId, displayName FROM "GroupMember" ORDER BY createdAt, id`
      )
      .all() as MemberRow[];
    const expenseRows = database
      .prepare(`SELECT id, groupId, amountCents, paidBy, settled FROM "Expense"`)
      .all() as ExpenseRow[];
    const shareRows = database
      .prepare(`SELECT expenseId, memberId, amountCents FROM "ExpenseShare"`)
      .all() as ShareRow[];
    const settlementRows = database
      .prepare(
        `SELECT id, groupId, fromMemberId, toMemberId, amountCents FROM "Settlement"`
      )
      .all() as SettlementRow[];

    const sharesByExpense = new Map<string, Record<string, number>>();
    for (const share of shareRows) {
      const shares = sharesByExpense.get(share.expenseId) ?? {};
      shares[share.memberId] = share.amountCents;
      sharesByExpense.set(share.expenseId, shares);
    }

    const users = userRows.map(({ id, displayName }) => ({ id, displayName }));
    const groups = groupRows.map((group): GroupCardData => {
      const members = memberRows.filter((member) => member.groupId === group.id);
      const expenses: Expense[] = expenseRows
        .filter((expense) => expense.groupId === group.id)
        .map((expense) => ({
          id: expense.id,
          amountCents: expense.amountCents,
          paidBy: expense.paidBy,
          shares: sharesByExpense.get(expense.id) ?? {},
          settled: Boolean(expense.settled),
        }));

      for (const settlement of settlementRows.filter(
        (item) => item.groupId === group.id
      )) {
        expenses.push({
          id: `settlement:${settlement.id}`,
          amountCents: settlement.amountCents,
          paidBy: settlement.fromMemberId,
          shares: { [settlement.toMemberId]: settlement.amountCents },
        });
      }

      const balances = computeNetBalances(expenses);
      const balancesByUserId = Object.fromEntries(
        members.flatMap((member) =>
          member.userId ? [[member.userId, balances.get(member.id) ?? 0]] : []
        )
      );

      return {
        id: group.id,
        name: group.name,
        members: members.map(({ id, userId, displayName }) => ({
          id,
          userId,
          displayName,
        })),
        balancesByUserId,
      };
    });

    return { users, groups };
  } finally {
    database.close();
  }
}
