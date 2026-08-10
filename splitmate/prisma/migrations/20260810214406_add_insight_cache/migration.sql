-- CreateTable
CREATE TABLE "InsightCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "insights" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "InsightCache_scopeType_scopeId_createdAt_idx" ON "InsightCache"("scopeType", "scopeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "InsightCache_scopeType_scopeId_contentHash_key" ON "InsightCache"("scopeType", "scopeId", "contentHash");
