import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  bindEmail,
  createSyncSession,
  readSyncSession,
  registerDefaultUser,
  restoreByEmail,
  unbindEmail,
} from "./email-sync";
import { seedDatabase } from "../../prisma/seed";
import { getExportSummaryData } from "./export-summary";
import { getGroupDetail } from "./group-details";
import { getGroupListData } from "./groups";
import { getRelationshipPageData } from "./relationships";
import { openDatabase } from "./database";

const userId = "user-tom";
const email = "tom-sync-test@example.com";
const password = "sync-pass-123";

describe("optional email sync", () => {
  beforeEach(() => unbindEmail(userId));
  afterEach(() => unbindEmail(userId));

  it("keeps all existing data features available without binding", () => {
    const groups = getGroupListData().groups.filter((group) =>
      group.members.some((member) => member.userId === userId)
    );
    expect(groups.length).toBeGreaterThan(0);
    expect(getGroupDetail("group-home")).not.toBeNull();
    expect(getExportSummaryData("group-home")).not.toBeNull();
    expect(
      getRelationshipPageData("group-home", "member-home-xiaoli", userId)?.state
    ).toBe("ready");
  });

  it("restores the same user and their existing data with the bound email", async () => {
    await bindEmail(userId, email, password);
    const database = openDatabase();
    const stored = database
      .prepare(`SELECT passwordHash FROM "User" WHERE id = ?`)
      .get(userId) as { passwordHash: string };
    database.close();
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(stored.passwordHash).not.toContain(password);
    const restored = await restoreByEmail(email, password);
    expect(restored.userId).toBe(userId);
    expect(
      getGroupListData().groups.some((group) =>
        group.members.some((member) => member.userId === restored.userId)
      )
    ).toBe(true);
  });

  it("creates a verifiable http-only session value", () => {
    const value = createSyncSession(userId);
    expect(readSyncSession(value)).toBe(userId);
    expect(readSyncSession(`${value}changed`)).toBeNull();
  });
});

describe("welcome registration", () => {
  beforeEach(() => seedDatabase());
  afterEach(() => seedDatabase());

  it("registers the default demo user and keeps both seeded groups", async () => {
    const result = await registerDefaultUser(
      "陈晨",
      "welcome@example.com",
      "welcome-pass"
    );
    expect(result.userId).toBe("user-xiaoli");

    const restored = await restoreByEmail("welcome@example.com", "welcome-pass");
    expect(restored.userId).toBe("user-xiaoli");
    expect(
      getGroupListData().groups.filter((group) =>
        group.members.some((member) => member.userId === restored.userId)
      )
    ).toHaveLength(2);
  });

  it("returns the required message for a duplicate email", async () => {
    await registerDefaultUser("陈晨", "duplicate@example.com", "welcome-pass");
    await expect(
      registerDefaultUser("陈晨", "duplicate@example.com", "welcome-pass")
    ).rejects.toThrow("这个邮箱已经注册过了，试试登录");
  });

  it("does not reveal which credential is wrong", async () => {
    await expect(
      restoreByEmail("missing@example.com", "welcome-pass")
    ).rejects.toThrow("邮箱或密码不对");
  });
});
