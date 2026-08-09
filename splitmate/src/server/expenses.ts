import { openDatabase } from "@/server/database";

export interface ExpenseDetailData {
  id: string;
  groupId: string;
  groupName: string;
  description: string;
  amountCents: number;
  date: string;
  paidByName: string;
  settled: boolean;
  photoUrls: string[];
  shares: Array<{
    memberId: string;
    displayName: string;
    amountCents: number;
  }>;
}

interface ExpenseRow {
  id: string;
  groupId: string;
  groupName: string;
  description: string;
  amountCents: number;
  date: number | string;
  paidByName: string;
  settled: number;
  photoUrls: string | null;
}

interface ShareRow {
  memberId: string;
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
                expense.settled,
                expense.photoUrls,
                groupTable.name AS groupName,
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
        `SELECT share.memberId, member.displayName, share.amountCents
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
      description: expense.description,
      amountCents: expense.amountCents,
      date: new Date(expense.date).toISOString(),
      paidByName: expense.paidByName,
      settled: Boolean(expense.settled),
      photoUrls: parsePhotoUrls(expense.photoUrls),
      shares: shareRows.map(({ memberId, displayName, amountCents }) => ({
        memberId,
        displayName,
        amountCents,
      })),
    };
  } finally {
    database.close();
  }
}
