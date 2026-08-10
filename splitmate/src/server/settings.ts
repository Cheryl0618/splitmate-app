import { openDatabase, openWritableDatabase } from "@/server/database";

export interface AccountUserSummary {
  id: string;
  displayName: string;
}

export interface PersonalSettingsData extends AccountUserSummary {
  groupCount: number;
  expenseCount: number;
}

export class SettingsError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export function getAccountUsers(): AccountUserSummary[] {
  const database = openDatabase();
  try {
    const rows = database
      .prepare(`SELECT id, displayName FROM "User" ORDER BY createdAt, id`)
      .all() as AccountUserSummary[];
    return rows.map(({ id, displayName }) => ({ id, displayName }));
  } finally {
    database.close();
  }
}

export function getPersonalSettings(userId: string): PersonalSettingsData {
  if (!userId) throw new SettingsError("请先选择身份", 401);
  const database = openDatabase();
  try {
    const user = database
      .prepare(`SELECT id, displayName FROM "User" WHERE id = ?`)
      .get(userId) as AccountUserSummary | undefined;
    if (!user) throw new SettingsError("当前账号不存在，请重新选择身份", 404);
    const groupCount = database
      .prepare(`SELECT COUNT(*) AS count FROM "GroupMember" WHERE userId = ?`)
      .get(userId) as { count: number };
    const expenseCount = database
      .prepare(
        `SELECT COUNT(*) AS count
         FROM "Expense"
         WHERE groupId IN (SELECT groupId FROM "GroupMember" WHERE userId = ?)`
      )
      .get(userId) as { count: number };

    return {
      ...user,
      groupCount: groupCount.count,
      expenseCount: expenseCount.count,
    };
  } finally {
    database.close();
  }
}

export function updateDisplayName(userId: string, value: unknown) {
  if (!userId) throw new SettingsError("请先选择身份", 401);
  const displayName = typeof value === "string" ? value.trim() : "";
  if (!displayName) throw new SettingsError("显示名不能为空", 400);
  if (Array.from(displayName).length > 50) {
    throw new SettingsError("显示名不能超过 50 个字符", 400);
  }

  getPersonalSettings(userId);
  const database = openWritableDatabase();
  database.exec("BEGIN IMMEDIATE");
  try {
    database
      .prepare(`UPDATE "User" SET displayName = ?, updatedAt = ? WHERE id = ?`)
      .run(displayName, Date.now(), userId);
    database
      .prepare(`UPDATE "GroupMember" SET displayName = ? WHERE userId = ?`)
      .run(displayName, userId);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  } finally {
    database.close();
  }
  return getPersonalSettings(userId);
}
