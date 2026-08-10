-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "paidBy" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "splitMethod" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT '其他',
    "settled" BOOLEAN NOT NULL DEFAULT false,
    "tripId" TEXT,
    "location" TEXT,
    "photoUrls" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Expense_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Expense_paidBy_fkey" FOREIGN KEY ("paidBy") REFERENCES "GroupMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Expense" ("amountCents", "category", "createdAt", "createdById", "date", "description", "groupId", "id", "location", "paidBy", "photoUrls", "settled", "splitMethod", "tripId", "updatedAt") SELECT "amountCents", coalesce("category", '其他') AS "category", "createdAt", "createdById", "date", "description", "groupId", "id", "location", "paidBy", "photoUrls", "settled", "splitMethod", "tripId", "updatedAt" FROM "Expense";
DROP TABLE "Expense";
ALTER TABLE "new_Expense" RENAME TO "Expense";
CREATE INDEX "Expense_groupId_date_idx" ON "Expense"("groupId", "date");
CREATE INDEX "Expense_paidBy_idx" ON "Expense"("paidBy");
CREATE INDEX "Expense_createdById_idx" ON "Expense"("createdById");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
