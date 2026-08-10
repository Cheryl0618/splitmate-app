import { randomUUID } from "node:crypto";

import { supportedCurrencies, type Currency } from "@/lib/currency";
import { validateMemberCount } from "@/lib/limits";
import { LimitValidationError } from "@/lib/limits";
import { parseMemberNames } from "@/lib/member-names";
import { openDatabase, openWritableDatabase } from "@/server/database";

export class GroupMutationError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

function parseGroupInput(value: unknown) {
  if (!value || typeof value !== "object") {
    throw new GroupMutationError("群组数据格式不正确", 400);
  }
  const input = value as Record<string, unknown>;
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const currency = input.currency;
  if (!name) throw new GroupMutationError("请填写群组名称", 400);
  if (
    typeof currency !== "string" ||
    !supportedCurrencies.includes(currency as Currency)
  ) {
    throw new GroupMutationError("请选择支持的群组货币", 400);
  }
  return {
    name,
    currency: currency as Currency,
    memberNames:
      typeof input.memberNames === "string"
        ? parseMemberNames(input.memberNames)
        : [],
  };
}

interface UserRow {
  id: string;
  displayName: string;
}

function validateGroupMemberCount(memberCount: number) {
  try {
    validateMemberCount(memberCount);
  } catch (error) {
    if (error instanceof LimitValidationError) {
      throw new GroupMutationError(error.message, 400);
    }
    throw error;
  }
}

function resolveMembers(
  names: string[],
  users: UserRow[],
  currentUserId: string,
  existingMembers: Array<{ userId: string | null; displayName: string }> = []
) {
  const userByName = new Map<string, UserRow>();
  for (const user of users) {
    if (!userByName.has(user.displayName)) userByName.set(user.displayName, user);
  }
  const existingUserIds = new Set(
    existingMembers.flatMap((member) => (member.userId ? [member.userId] : []))
  );
  const existingNames = new Set(existingMembers.map((member) => member.displayName));

  return names.flatMap((displayName) => {
    const user = userByName.get(displayName);
    if (existingNames.has(displayName)) return [];
    if (user?.id === currentUserId || (user && existingUserIds.has(user.id))) return [];
    return [{ displayName, userId: user?.id ?? null }];
  });
}

export function createGroup(currentUserId: string, value: unknown) {
  if (!currentUserId) throw new GroupMutationError("缺少当前用户", 401);
  const input = parseGroupInput(value);
  const database = openDatabase();
  let user: { id: string; displayName: string } | undefined;
  let users: UserRow[] = [];
  try {
    user = database
      .prepare(`SELECT id, displayName FROM "User" WHERE id = ?`)
      .get(currentUserId) as { id: string; displayName: string } | undefined;
    users = database
      .prepare(`SELECT id, displayName FROM "User" ORDER BY createdAt, id`)
      .all() as UserRow[];
  } finally {
    database.close();
  }
  if (!user) throw new GroupMutationError("当前用户不存在", 404);
  const additionalMembers = resolveMembers(input.memberNames, users, currentUserId);
  validateGroupMemberCount(1 + additionalMembers.length);

  const groupId = randomUUID();
  const now = Date.now();
  const writable = openWritableDatabase();
  writable.exec("BEGIN IMMEDIATE");
  try {
    writable
      .prepare(
        `INSERT INTO "Group" (id, name, currency, ownerId, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(groupId, input.name, input.currency, currentUserId, now, now);
    const insertMember = writable.prepare(
      `INSERT INTO "GroupMember" (id, groupId, userId, displayName, createdAt)
       VALUES (?, ?, ?, ?, ?)`
    );
    insertMember.run(randomUUID(), groupId, currentUserId, user.displayName, now);
    for (const member of additionalMembers) {
      insertMember.run(
        randomUUID(),
        groupId,
        member.userId,
        member.displayName,
        now
      );
    }
    writable.exec("COMMIT");
    return { groupId };
  } catch (error) {
    writable.exec("ROLLBACK");
    throw error;
  } finally {
    writable.close();
  }
}

export function addGroupMembers(
  groupId: string,
  currentUserId: string,
  value: unknown
) {
  if (!currentUserId) throw new GroupMutationError("缺少当前用户", 401);
  if (!value || typeof value !== "object") {
    throw new GroupMutationError("成员数据格式不正确", 400);
  }
  const rawNames = (value as Record<string, unknown>).memberNames;
  if (typeof rawNames !== "string") {
    throw new GroupMutationError("请输入要添加的成员名字", 400);
  }
  const names = parseMemberNames(rawNames);
  if (names.length === 0) throw new GroupMutationError("请输入至少一个成员名字", 400);

  const database = openDatabase();
  let users: UserRow[] = [];
  let existingMembers: Array<{ userId: string | null; displayName: string }> = [];
  try {
    const membership = database
      .prepare(
        `SELECT id FROM "GroupMember" WHERE groupId = ? AND userId = ? LIMIT 1`
      )
      .get(groupId, currentUserId);
    if (!membership) throw new GroupMutationError("当前用户不属于这个群组", 403);
    users = database
      .prepare(`SELECT id, displayName FROM "User" ORDER BY createdAt, id`)
      .all() as UserRow[];
    existingMembers = database
      .prepare(`SELECT userId, displayName FROM "GroupMember" WHERE groupId = ?`)
      .all(groupId) as Array<{ userId: string | null; displayName: string }>;
  } finally {
    database.close();
  }

  const additionalMembers = resolveMembers(
    names,
    users,
    currentUserId,
    existingMembers
  );
  validateGroupMemberCount(existingMembers.length + additionalMembers.length);
  if (additionalMembers.length === 0) return { groupId, addedCount: 0 };

  const writable = openWritableDatabase();
  writable.exec("BEGIN IMMEDIATE");
  try {
    const insertMember = writable.prepare(
      `INSERT INTO "GroupMember" (id, groupId, userId, displayName, createdAt)
       VALUES (?, ?, ?, ?, ?)`
    );
    const now = Date.now();
    for (const member of additionalMembers) {
      insertMember.run(
        randomUUID(),
        groupId,
        member.userId,
        member.displayName,
        now
      );
    }
    writable.exec("COMMIT");
    return { groupId, addedCount: additionalMembers.length };
  } catch (error) {
    writable.exec("ROLLBACK");
    throw error;
  } finally {
    writable.close();
  }
}

export function updateGroup(
  groupId: string,
  currentUserId: string,
  value: unknown
) {
  if (!currentUserId) throw new GroupMutationError("缺少当前用户", 401);
  const input = parseGroupInput(value);
  const database = openWritableDatabase();
  try {
    const group = database
      .prepare(`SELECT ownerId FROM "Group" WHERE id = ?`)
      .get(groupId) as { ownerId: string } | undefined;
    if (!group) throw new GroupMutationError("群组不存在", 404);
    if (group.ownerId !== currentUserId) {
      throw new GroupMutationError("只有群主可以修改群组设置", 403);
    }
    database
      .prepare(`UPDATE "Group" SET name = ?, currency = ?, updatedAt = ? WHERE id = ?`)
      .run(input.name, input.currency, Date.now(), groupId);
    return { groupId };
  } finally {
    database.close();
  }
}
