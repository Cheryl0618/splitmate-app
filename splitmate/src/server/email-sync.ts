import { createHmac, timingSafeEqual } from "node:crypto";
import bcrypt from "bcrypt";

import { DEFAULT_AVATAR_COLOR } from "@/lib/avatar-colors";
import { DEFAULT_DEMO_USER_ID, normalizeDisplayName } from "@/lib/demo-identity";
import { openDatabase, openWritableDatabase } from "@/server/database";

const SESSION_SECRET = process.env.SESSION_SECRET ?? "quits-local-sync-secret";

export const SYNC_SESSION_COOKIE = "quits-sync-session";

export class EmailSyncError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function normalizeEmail(value: unknown) {
  const email = typeof value === "string" ? value.trim().toLocaleLowerCase("en-US") : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new EmailSyncError("请输入有效的邮箱", 400);
  }
  return email;
}

function validatePassword(value: unknown) {
  if (typeof value !== "string" || value.length < 8) {
    throw new EmailSyncError("密码至少需要 8 位", 400);
  }
  return value;
}

export async function bindEmail(userId: string, emailValue: unknown, passwordValue: unknown) {
  if (!userId) throw new EmailSyncError("请先完成首次设置", 401);
  const email = normalizeEmail(emailValue);
  const password = validatePassword(passwordValue);
  const database = openDatabase();
  try {
    const user = database
      .prepare(`SELECT id, email FROM "User" WHERE id = ?`)
      .get(userId) as { id: string; email: string | null } | undefined;
    if (!user) throw new EmailSyncError("本机信息已失效，请重置后重新开始", 404);
    if (user.email) throw new EmailSyncError("已经绑定邮箱", 409);
    const duplicate = database
      .prepare(`SELECT id FROM "User" WHERE email = ?`)
      .get(email) as { id: string } | undefined;
    if (duplicate) throw new EmailSyncError("这个邮箱已经用于同步其他数据", 409);
  } finally {
    database.close();
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const writable = openWritableDatabase();
  try {
    writable
      .prepare(
        `UPDATE "User"
         SET email = ?, passwordHash = ?, updatedAt = ?
         WHERE id = ? AND email IS NULL`
      )
      .run(email, passwordHash, Date.now(), userId);
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE")) {
      throw new EmailSyncError("这个邮箱已经用于同步其他数据", 409);
    }
    throw error;
  } finally {
    writable.close();
  }
  return { userId, email };
}

export async function restoreByEmail(emailValue: unknown, passwordValue: unknown) {
  const email = normalizeEmail(emailValue);
  const password = validatePassword(passwordValue);
  const database = openDatabase();
  try {
    const user = database
      .prepare(
        `SELECT id, displayName, passwordHash
         FROM "User"
         WHERE email = ?`
      )
      .get(email) as
      | { id: string; displayName: string; passwordHash: string | null }
      | undefined;
    if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new EmailSyncError("邮箱或密码不对", 401);
    }
    return { userId: user.id, displayName: user.displayName };
  } finally {
    database.close();
  }
}

export async function registerDefaultUser(
  displayNameValue: unknown,
  emailValue: unknown,
  passwordValue: unknown
) {
  let displayName: string;
  try {
    displayName = normalizeDisplayName(displayNameValue);
  } catch (error) {
    throw new EmailSyncError(
      error instanceof Error ? error.message : "名字需要 2 到 20 个字",
      400
    );
  }
  const email = normalizeEmail(emailValue);
  const password = validatePassword(passwordValue);
  const passwordHash = await bcrypt.hash(password, 12);
  const database = openWritableDatabase();
  database.exec("BEGIN IMMEDIATE");
  try {
    const duplicate = database
      .prepare(`SELECT id FROM "User" WHERE email = ?`)
      .get(email) as { id: string } | undefined;
    if (duplicate) {
      throw new EmailSyncError("这个邮箱已经注册过了，试试登录", 409);
    }
    const result = database
      .prepare(
        `UPDATE "User"
         SET displayName = ?, avatarColor = ?, email = ?, passwordHash = ?, updatedAt = ?
         WHERE id = ? AND email IS NULL`
      )
      .run(
        displayName,
        DEFAULT_AVATAR_COLOR,
        email,
        passwordHash,
        Date.now(),
        DEFAULT_DEMO_USER_ID
      ) as { changes: number };
    if (result.changes === 0) {
      throw new EmailSyncError("默认演示数据已经绑定邮箱，请登录", 409);
    }
    database
      .prepare(
        `UPDATE "GroupMember"
         SET displayName = ?, avatarColor = ?
         WHERE userId = ?`
      )
      .run(displayName, DEFAULT_AVATAR_COLOR, DEFAULT_DEMO_USER_ID);
    database.exec("COMMIT");
    return { userId: DEFAULT_DEMO_USER_ID, email };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  } finally {
    database.close();
  }
}

export function unbindEmail(userId: string) {
  if (!userId) throw new EmailSyncError("请先完成首次设置", 401);
  const database = openWritableDatabase();
  try {
    database
      .prepare(
        `UPDATE "User"
         SET email = NULL, passwordHash = NULL, updatedAt = ?
         WHERE id = ?`
      )
      .run(Date.now(), userId);
  } finally {
    database.close();
  }
}

export function createSyncSession(userId: string) {
  const signature = createHmac("sha256", SESSION_SECRET)
    .update(userId)
    .digest("base64url");
  return `${Buffer.from(userId).toString("base64url")}.${signature}`;
}

export function readSyncSession(value: string | undefined) {
  if (!value) return null;
  const [encodedUserId, signature] = value.split(".");
  if (!encodedUserId || !signature) return null;
  const userId = Buffer.from(encodedUserId, "base64url").toString("utf8");
  const expected = createHmac("sha256", SESSION_SECRET)
    .update(userId)
    .digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
    ? userId
    : null;
}
