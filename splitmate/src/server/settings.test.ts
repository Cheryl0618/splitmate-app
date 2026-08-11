import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { seedDatabase } from "../../prisma/seed";
import { openDatabase } from "./database";
import {
  getPersonalSettings,
  initializeDefaultProfile,
  resetAllDemoData,
} from "./settings";

describe("personal settings", () => {
  beforeEach(() => seedDatabase());
  afterAll(() => seedDatabase());

  it("writes the first-use name and color to the default demo user", () => {
    const result = initializeDefaultProfile("陈晨", "rose");
    expect(result).toMatchObject({
      id: "user-xiaoli",
      displayName: "陈晨",
      avatarColor: "rose",
    });

    const database = openDatabase();
    try {
      const names = database
        .prepare(
          `SELECT displayName, avatarColor FROM "GroupMember"
           WHERE userId = ? ORDER BY groupId`
        )
        .all("user-xiaoli") as Array<{ displayName: string; avatarColor: string }>;
      expect(names).toHaveLength(2);
      expect(names.every(({ displayName }) => displayName === "陈晨")).toBe(true);
      expect(names.every(({ avatarColor }) => avatarColor === "rose")).toBe(true);
    } finally {
      database.close();
    }
  });

  it("uses the default color when the color is skipped", () => {
    expect(initializeDefaultProfile("陈晨", undefined).avatarColor).toBe("teal");
  });

  it("restores all seed data", () => {
    initializeDefaultProfile("陈晨", "rose");
    resetAllDemoData("user-xiaoli");
    expect(getPersonalSettings("user-xiaoli")).toMatchObject({
      displayName: "小李",
      avatarColor: "teal",
      groupCount: 2,
    });
  });
});
