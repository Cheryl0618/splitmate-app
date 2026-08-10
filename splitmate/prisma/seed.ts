import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { demoUsers, seedGroups } from "../src/lib/seed-data.ts";

function databasePath() {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  if (!url.startsWith("file:")) {
    throw new Error("seed only supports a SQLite file DATABASE_URL");
  }
  return resolve(process.cwd(), url.slice("file:".length));
}

export function seedDatabase() {
  const database = new DatabaseSync(databasePath());
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("BEGIN");

  try {
    database.exec(`
      DELETE FROM "InsightCache";
      DELETE FROM "Settlement";
      DELETE FROM "ExpenseShare";
      DELETE FROM "Expense";
      DELETE FROM "GroupMember";
      DELETE FROM "Group";
      DELETE FROM "User";
    `);

    const now = Date.now();
    const insertUser = database.prepare(`
      INSERT INTO "User" (id, displayName, email, phone, createdAt, updatedAt)
      VALUES (?, ?, ?, NULL, ?, ?)
    `);
    const insertGroup = database.prepare(`
      INSERT INTO "Group" (id, name, ownerId, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?)
    `);
    const insertMember = database.prepare(`
      INSERT INTO "GroupMember" (id, groupId, userId, displayName, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `);
    const insertExpense = database.prepare(`
      INSERT INTO "Expense" (
        id, groupId, description, amountCents, paidBy, createdById, date,
        splitMethod, category, settled, tripId, location, photoUrls, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, NULL, ?, ?)
    `);
    const insertShare = database.prepare(`
      INSERT INTO "ExpenseShare" (id, expenseId, memberId, amountCents)
      VALUES (?, ?, ?, ?)
    `);
    const insertSettlement = database.prepare(`
      INSERT INTO "Settlement" (
        id, groupId, fromMemberId, toMemberId, amountCents, confirmedAt
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const user of demoUsers) {
      insertUser.run(user.id, user.displayName, user.email, now, now);
    }

    for (const group of seedGroups) {
      insertGroup.run(group.id, group.name, group.ownerId, now, now);

      for (const member of group.members) {
        insertMember.run(member.id, group.id, member.userId, member.displayName, now);
      }

      for (const expense of group.expenses) {
        const shareTotal = Object.values(expense.shares).reduce(
          (total, amountCents) => total + amountCents,
          0
        );
        if (shareTotal !== expense.amountCents) {
          throw new Error(
            `${expense.id}: shares sum to ${shareTotal}, expected ${expense.amountCents}`
          );
        }

        insertExpense.run(
          expense.id,
          group.id,
          expense.description,
          expense.amountCents,
          expense.paidBy,
          expense.createdById,
          Date.parse(expense.date),
          expense.splitMethod,
          expense.category,
          now,
          now
        );

        for (const [memberId, amountCents] of Object.entries(expense.shares)) {
          insertShare.run(`${expense.id}:${memberId}`, expense.id, memberId, amountCents);
        }
      }

      for (const settlement of group.settlements) {
        insertSettlement.run(
          settlement.id,
          group.id,
          settlement.fromMemberId,
          settlement.toMemberId,
          settlement.amountCents,
          Date.parse(settlement.confirmedAt)
        );
      }
    }

    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  } finally {
    database.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedDatabase();
}
