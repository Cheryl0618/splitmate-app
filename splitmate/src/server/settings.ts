import { openDatabase, openWritableDatabase } from "@/server/database";
import { normalizeAvatarColor, type AvatarColor } from "@/lib/avatar-colors";
import { DEFAULT_DEMO_USER_ID, normalizeDisplayName } from "@/lib/demo-identity";
import { seedDatabase } from "@/server/seed-database";

export interface UserProfileSummary {
  id: string;
  displayName: string;
  avatarColor: AvatarColor;
}

export interface PersonalSettingsData extends UserProfileSummary {
  email: string | null;
  groupCount: number;
  expenseCount: number;
}

export class SettingsError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export function getPersonalSettings(userId: string): PersonalSettingsData {
  if (!userId) throw new SettingsError("请先完成首次设置", 401);
  const database = openDatabase();
  try {
    const user = database
      .prepare(`SELECT id, displayName, avatarColor, email FROM "User" WHERE id = ?`)
      .get(userId) as
      | (Omit<UserProfileSummary, "avatarColor"> & {
          avatarColor: string;
          email: string | null;
        })
      | undefined;
    if (!user) throw new SettingsError("本机信息已失效，请重置后重新开始", 404);
    const groupCount = database
      .prepare(`SELECT COUNT(*) AS count FROM "GroupMember" WHERE userId = ?`)
      .get(userId) as { count: number };
    const expenseCount = database
      .prepare(
        `SELECT COUNT(*) AS count FROM "Expense" WHERE createdById = ?`
      )
      .get(userId) as { count: number };

    return {
      ...user,
      avatarColor: normalizeAvatarColor(user.avatarColor),
      groupCount: groupCount.count,
      expenseCount: expenseCount.count,
    };
  } finally {
    database.close();
  }
}

function profileInput(displayNameValue: unknown, avatarColorValue: unknown) {
  try {
    return {
      displayName: normalizeDisplayName(displayNameValue),
      avatarColor: normalizeAvatarColor(avatarColorValue),
    };
  } catch (error) {
    throw new SettingsError(
      error instanceof Error ? error.message : "名字需要 2 到 20 个字",
      400
    );
  }
}

function writeProfile(userId: string, displayName: string, avatarColor: AvatarColor) {
  const database = openWritableDatabase();
  database.exec("BEGIN IMMEDIATE");
  try {
    const result = database
      .prepare(
        `UPDATE "User"
         SET displayName = ?, avatarColor = ?, updatedAt = ?
         WHERE id = ?`
      )
      .run(displayName, avatarColor, Date.now(), userId) as { changes: number };
    if (result.changes === 0) {
      throw new SettingsError("默认演示数据不存在，请先重新 seed", 404);
    }
    database
      .prepare(
        `UPDATE "GroupMember"
         SET displayName = ?, avatarColor = ?
         WHERE userId = ?`
      )
      .run(displayName, avatarColor, userId);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  } finally {
    database.close();
  }
}

export function initializeDefaultProfile(
  displayNameValue: unknown,
  avatarColorValue: unknown
) {
  const profile = profileInput(displayNameValue, avatarColorValue);
  writeProfile(DEFAULT_DEMO_USER_ID, profile.displayName, profile.avatarColor);
  return getPersonalSettings(DEFAULT_DEMO_USER_ID);
}

export function updateProfile(
  userId: string,
  displayNameValue: unknown,
  avatarColorValue: unknown
) {
  if (!userId) throw new SettingsError("请先完成首次设置", 401);
  const profile = profileInput(displayNameValue, avatarColorValue);

  getPersonalSettings(userId);
  writeProfile(userId, profile.displayName, profile.avatarColor);
  return getPersonalSettings(userId);
}

export function resetAllDemoData(userId: string, locale: "zh" | "en" = "zh") {
  getPersonalSettings(userId);
  seedDatabase(locale);
}
