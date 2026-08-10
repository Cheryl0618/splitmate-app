import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { seedDatabase } from "../../prisma/seed";
import { openDatabase, openWritableDatabase } from "./database";
import { createGroup } from "./group-mutations";

const createdGroupIds: string[] = [];

function membersForGroup(groupId: string) {
  const database = openDatabase();
  try {
    return database
      .prepare(
        `SELECT userId, displayName
         FROM "GroupMember"
         WHERE groupId = ?
         ORDER BY createdAt, id`
      )
      .all(groupId) as Array<{ userId: string | null; displayName: string }>;
  } finally {
    database.close();
  }
}

describe("createGroup with members", () => {
  beforeEach(() => seedDatabase());

  afterEach(() => {
    const database = openWritableDatabase();
    try {
      for (const groupId of createdGroupIds.splice(0)) {
        database.prepare(`DELETE FROM "Group" WHERE id = ?`).run(groupId);
      }
    } finally {
      database.close();
    }
  });

  it("creates two named members plus the current user", () => {
    const { groupId } = createGroup("user-xiaoli", {
      name: "周末海边",
      currency: "CNY",
      memberNames: "小明，小红",
    });
    createdGroupIds.push(groupId);

    const members = membersForGroup(groupId);
    expect(members).toHaveLength(3);
    expect(members.map((member) => member.displayName).sort()).toEqual(
      ["小李", "小明", "小红"].sort()
    );
    expect(
      members
        .filter((member) => member.displayName !== "小李")
        .every((member) => member.userId === null)
    ).toBe(true);
  });

  it("links an existing display name to its real user account", () => {
    const { groupId } = createGroup("user-xiaoli", {
      name: "朋友聚会",
      currency: "USD",
      memberNames: "Lucy",
    });
    createdGroupIds.push(groupId);

    expect(membersForGroup(groupId)).toContainEqual({
      displayName: "Lucy",
      userId: "user-lucy",
    });
  });

  it("ignores duplicate names and blank entries across all separators", () => {
    const { groupId } = createGroup("user-xiaoli", {
      name: "重复测试",
      currency: "CNY",
      memberNames: "小明, 小明，，\n  ,小红\n小红",
    });
    createdGroupIds.push(groupId);

    expect(
      membersForGroup(groupId).map((member) => member.displayName).sort()
    ).toEqual(["小李", "小明", "小红"].sort());
  });
});
