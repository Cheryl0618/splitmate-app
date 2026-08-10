import { openDatabase } from "@/server/database";
import type { ExpenseCategory } from "@/lib/expense-input";
import type { SplitMethod } from "@/lib/split";
import type { Currency } from "@/lib/currency";

export interface ExpenseFormMember {
  id: string;
  userId: string | null;
  displayName: string;
}

export interface ExpenseFormGroupData {
  id: string;
  name: string;
  currency: Currency;
  members: ExpenseFormMember[];
}

export interface ExpenseDetailData {
  id: string;
  groupId: string;
  groupName: string;
  currency: Currency;
  description: string;
  amountCents: number;
  date: string;
  paidByMemberId: string;
  paidByUserId: string | null;
  paidByName: string;
  createdById: string;
  category: ExpenseCategory;
  splitMethod: SplitMethod;
  settled: boolean;
  photoUrls: string[];
  shares: Array<{
    memberId: string;
    userId: string | null;
    displayName: string;
    amountCents: number;
  }>;
}

interface ExpenseRow {
  id: string;
  groupId: string;
  groupName: string;
  currency: Currency;
  description: string;
  amountCents: number;
  date: number | string;
  paidByMemberId: string;
  paidByUserId: string | null;
  paidByName: string;
  createdById: string;
  category: ExpenseCategory;
  splitMethod: "EQUAL" | "WEIGHTED" | "EXACT";
  settled: number;
  photoUrls: string | null;
}

interface ShareRow {
  memberId: string;
  userId: string | null;
  displayName: string;
  amountCents: number;
}

function parsePhotoUrls(value: string | null) {
  if (!value) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function splitMethodFromDatabase(
  method: ExpenseRow["splitMethod"]
): SplitMethod {
  return method === "EQUAL" ? "equal" : method === "WEIGHTED" ? "percentage" : "amount";
}

export function getExpenseFormGroup(groupId: string): ExpenseFormGroupData | null {
  const database = openDatabase();

  try {
    const group = database
      .prepare(`SELECT id, name, currency FROM "Group" WHERE id = ?`)
      .get(groupId) as { id: string; name: string; currency: Currency } | undefined;
    if (!group) return null;

    const memberRows = database
      .prepare(
        `SELECT id, userId, displayName
         FROM "GroupMember"
         WHERE groupId = ?
         ORDER BY createdAt, id`
      )
      .all(groupId) as ExpenseFormMember[];

    return {
      id: group.id,
      name: group.name,
      currency: group.currency,
      members: memberRows.map(({ id, userId, displayName }) => ({
        id,
        userId,
        displayName,
      })),
    };
  } finally {
    database.close();
  }
}

export function getExpenseDetail(expenseId: string): ExpenseDetailData | null {
  const database = openDatabase();

  try {
    const expense = database
      .prepare(
        `SELECT expense.id,
                expense.groupId,
                expense.description,
                expense.amountCents,
                expense.date,
                expense.paidBy AS paidByMemberId,
                payer.userId AS paidByUserId,
                expense.createdById,
                expense.category,
                expense.splitMethod,
                expense.settled,
                expense.photoUrls,
                groupTable.name AS groupName,
                groupTable.currency,
                payer.displayName AS paidByName
         FROM "Expense" AS expense
         INNER JOIN "Group" AS groupTable ON groupTable.id = expense.groupId
         INNER JOIN "GroupMember" AS payer ON payer.id = expense.paidBy
         WHERE expense.id = ?`
      )
      .get(expenseId) as ExpenseRow | undefined;
    if (!expense) return null;

    const shareRows = database
      .prepare(
        `SELECT share.memberId, member.userId, member.displayName, share.amountCents
         FROM "ExpenseShare" AS share
         INNER JOIN "GroupMember" AS member ON member.id = share.memberId
         WHERE share.expenseId = ?
         ORDER BY member.createdAt, member.id`
      )
      .all(expenseId) as ShareRow[];

    return {
      id: expense.id,
      groupId: expense.groupId,
      groupName: expense.groupName,
      currency: expense.currency,
      description: expense.description,
      amountCents: expense.amountCents,
      date: new Date(expense.date).toISOString(),
      paidByMemberId: expense.paidByMemberId,
      paidByUserId: expense.paidByUserId,
      paidByName: expense.paidByName,
      createdById: expense.createdById,
      category: expense.category,
      splitMethod: splitMethodFromDatabase(expense.splitMethod),
      settled: Boolean(expense.settled),
      photoUrls: parsePhotoUrls(expense.photoUrls),
      shares: shareRows.map(({ memberId, userId, displayName, amountCents }) => ({
        memberId,
        userId,
        displayName,
        amountCents,
      })),
    };
  } finally {
    database.close();
  }
}
