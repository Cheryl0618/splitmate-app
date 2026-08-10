import { randomUUID } from "node:crypto";

import {
  expenseCategories,
  type ExpenseCategory,
  type ExpenseInput,
} from "@/lib/expense-input";
import {
  calculateShares,
  type SplitMethod,
  type SplitParticipant,
} from "@/lib/split";
import { openDatabase, openWritableDatabase } from "@/server/database";

export class ExpenseMutationError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

interface ExpenseOwnerRow {
  id: string;
  groupId: string;
  createdById: string;
}

interface MemberIdRow {
  id: string;
}

function parseInput(value: unknown): ExpenseInput {
  if (!value || typeof value !== "object") {
    throw new ExpenseMutationError("账单数据格式不正确", 400);
  }

  const input = value as Record<string, unknown>;
  const method = input.method;
  if (method !== "equal" && method !== "percentage" && method !== "amount") {
    throw new ExpenseMutationError("分摊方式无效", 400);
  }
  if (!Array.isArray(input.participants)) {
    throw new ExpenseMutationError("请选择参与成员", 400);
  }
  if (
    typeof input.category !== "string" ||
    !expenseCategories.includes(input.category as ExpenseCategory)
  ) {
    throw new ExpenseMutationError("账单分类无效", 400);
  }

  const participants: SplitParticipant[] = input.participants.map((item) => {
    if (!item || typeof item !== "object") {
      throw new ExpenseMutationError("参与成员数据格式不正确", 400);
    }
    const participant = item as Record<string, unknown>;
    return {
      memberId: typeof participant.memberId === "string" ? participant.memberId : "",
      percentage:
        typeof participant.percentage === "number"
          ? participant.percentage
          : undefined,
      amountCents:
        typeof participant.amountCents === "number"
          ? participant.amountCents
          : undefined,
    };
  });

  return {
    amountCents:
      typeof input.amountCents === "number" ? input.amountCents : Number.NaN,
    description: typeof input.description === "string" ? input.description.trim() : "",
    date: typeof input.date === "string" ? input.date : "",
    paidBy: typeof input.paidBy === "string" ? input.paidBy : "",
    category: input.category as ExpenseCategory,
    method: method as SplitMethod,
    participants,
    photoUrls: Array.isArray(input.photoUrls)
      ? input.photoUrls.filter(
          (photoUrl): photoUrl is string =>
            typeof photoUrl === "string" && photoUrl.startsWith("data:image/")
        )
      : undefined,
  };
}

function validateInput(value: unknown) {
  const input = parseInput(value);
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new ExpenseMutationError("账单金额必须大于零且精确到分", 400);
  }
  if (!input.description) {
    throw new ExpenseMutationError("请填写账单说明", 400);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw new ExpenseMutationError("账单日期格式不正确", 400);
  }
  const date = Date.parse(`${input.date}T12:00:00.000Z`);
  if (
    Number.isNaN(date) ||
    new Date(date).toISOString().slice(0, 10) !== input.date
  ) {
    throw new ExpenseMutationError("账单日期无效", 400);
  }

  try {
    return { input, shares: calculateShares(input.amountCents, input.method, input.participants), date };
  } catch (error) {
    throw new ExpenseMutationError(
      error instanceof Error ? error.message : "分摊数据无效",
      400
    );
  }
}

function splitMethodForDatabase(method: SplitMethod) {
  return method === "equal" ? "EQUAL" : method === "percentage" ? "WEIGHTED" : "EXACT";
}

function validateMembers(
  groupId: string,
  paidBy: string,
  participants: SplitParticipant[],
  currentUserId: string,
  memberRows: MemberIdRow[]
) {
  const memberIds = new Set(memberRows.map((member) => member.id));
  if (!memberIds.has(paidBy)) {
    throw new ExpenseMutationError("付款人不属于这个群组", 400);
  }
  if (participants.some((participant) => !memberIds.has(participant.memberId))) {
    throw new ExpenseMutationError("参与人不属于这个群组", 400);
  }

  const database = openDatabase();
  try {
    const membership = database
      .prepare(
        `SELECT id FROM "GroupMember" WHERE groupId = ? AND userId = ? LIMIT 1`
      )
      .get(groupId, currentUserId);
    if (!membership) {
      throw new ExpenseMutationError("当前用户不属于这个群组", 403);
    }
  } finally {
    database.close();
  }
}

export function createExpense(
  groupId: string,
  currentUserId: string,
  value: unknown
) {
  if (!currentUserId) {
    throw new ExpenseMutationError("缺少当前用户", 401);
  }

  const { input, shares, date } = validateInput(value);
  const database = openDatabase();
  const memberRows = database
    .prepare(`SELECT id FROM "GroupMember" WHERE groupId = ?`)
    .all(groupId) as MemberIdRow[];
  database.close();
  validateMembers(groupId, input.paidBy, input.participants, currentUserId, memberRows);

  const expenseId = randomUUID();
  const now = Date.now();
  const writable = openWritableDatabase();
  writable.exec("BEGIN IMMEDIATE");
  try {
    writable
      .prepare(
        `INSERT INTO "Expense" (
          id, groupId, description, amountCents, paidBy, createdById, date,
          splitMethod, category, settled, tripId, location, photoUrls, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, ?, ?, ?)`
      )
      .run(
        expenseId,
        groupId,
        input.description,
        input.amountCents,
        input.paidBy,
        currentUserId,
        date,
        splitMethodForDatabase(input.method),
        input.category,
        input.photoUrls?.length ? JSON.stringify(input.photoUrls) : null,
        now,
        now
      );
    const insertShare = writable.prepare(
      `INSERT INTO "ExpenseShare" (id, expenseId, memberId, amountCents)
       VALUES (?, ?, ?, ?)`
    );
    for (const [memberId, amountCents] of Object.entries(shares)) {
      insertShare.run(`${expenseId}:${memberId}`, expenseId, memberId, amountCents);
    }
    writable.exec("COMMIT");
    return { expenseId, groupId };
  } catch (error) {
    writable.exec("ROLLBACK");
    throw error;
  } finally {
    writable.close();
  }
}

export function updateExpense(
  expenseId: string,
  currentUserId: string,
  value: unknown
) {
  if (!currentUserId) {
    throw new ExpenseMutationError("缺少当前用户", 401);
  }

  const { input, shares, date } = validateInput(value);
  const database = openDatabase();
  const expense = database
    .prepare(`SELECT id, groupId, createdById FROM "Expense" WHERE id = ?`)
    .get(expenseId) as ExpenseOwnerRow | undefined;
  if (!expense) {
    database.close();
    throw new ExpenseMutationError("账单不存在", 404);
  }
  if (expense.createdById !== currentUserId) {
    database.close();
    throw new ExpenseMutationError("只有账单创建者可以编辑", 403);
  }
  const memberRows = database
    .prepare(`SELECT id FROM "GroupMember" WHERE groupId = ?`)
    .all(expense.groupId) as MemberIdRow[];
  database.close();
  validateMembers(
    expense.groupId,
    input.paidBy,
    input.participants,
    currentUserId,
    memberRows
  );

  const writable = openWritableDatabase();
  writable.exec("BEGIN IMMEDIATE");
  try {
    writable
      .prepare(
        `UPDATE "Expense"
         SET description = ?, amountCents = ?, paidBy = ?, date = ?, splitMethod = ?, category = ?, updatedAt = ?
         WHERE id = ?`
      )
      .run(
        input.description,
        input.amountCents,
        input.paidBy,
        date,
        splitMethodForDatabase(input.method),
        input.category,
        Date.now(),
        expenseId
      );
    writable.prepare(`DELETE FROM "ExpenseShare" WHERE expenseId = ?`).run(expenseId);
    const insertShare = writable.prepare(
      `INSERT INTO "ExpenseShare" (id, expenseId, memberId, amountCents)
       VALUES (?, ?, ?, ?)`
    );
    for (const [memberId, amountCents] of Object.entries(shares)) {
      insertShare.run(`${expenseId}:${memberId}`, expenseId, memberId, amountCents);
    }
    writable.exec("COMMIT");
    return { expenseId, groupId: expense.groupId };
  } catch (error) {
    writable.exec("ROLLBACK");
    throw error;
  } finally {
    writable.close();
  }
}

export function deleteExpense(expenseId: string, currentUserId: string) {
  if (!currentUserId) {
    throw new ExpenseMutationError("缺少当前用户", 401);
  }

  const database = openWritableDatabase();
  try {
    const expense = database
      .prepare(`SELECT id, groupId, createdById FROM "Expense" WHERE id = ?`)
      .get(expenseId) as ExpenseOwnerRow | undefined;
    if (!expense) throw new ExpenseMutationError("账单不存在", 404);
    if (expense.createdById !== currentUserId) {
      throw new ExpenseMutationError("只有账单创建者可以删除", 403);
    }

    database.prepare(`DELETE FROM "Expense" WHERE id = ?`).run(expenseId);
    return { groupId: expense.groupId };
  } finally {
    database.close();
  }
}
