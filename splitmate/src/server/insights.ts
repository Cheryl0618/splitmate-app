import { createHash, randomUUID } from "node:crypto";

import {
  generateInsights,
  normalizeInsights,
  type Insight,
  type InsightType,
} from "@/lib/insights";
import type { GroupStats } from "@/lib/group-stats";
import type { RelationshipStats } from "@/lib/relationship";
import { openDatabase, openWritableDatabase } from "@/server/database";

type InsightStats = GroupStats | RelationshipStats;
type InsightGenerator = (
  stats: InsightStats,
  type: InsightType
) => Promise<Insight[]>;

export interface CachedInsightResult {
  insights: Insight[];
  cacheHit: boolean;
}

function stableValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stableValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableValue(entry)])
    );
  }
  return value;
}

export function statsContentHash(stats: InsightStats) {
  return createHash("sha256")
    .update(JSON.stringify(stableValue(stats)))
    .digest("hex");
}

function readCache(type: InsightType, scopeId: string, contentHash: string) {
  const database = openDatabase();
  try {
    const row = database
      .prepare(
        `SELECT insights FROM "InsightCache"
         WHERE scopeType = ? AND scopeId = ? AND contentHash = ?`
      )
      .get(type, scopeId, contentHash) as { insights: string } | undefined;
    if (!row) return null;
    try {
      const parsed = normalizeInsights({ insights: JSON.parse(row.insights) });
      return parsed.length > 0 ? parsed : null;
    } catch {
      return null;
    }
  } finally {
    database.close();
  }
}

function writeCache(
  type: InsightType,
  scopeId: string,
  contentHash: string,
  insights: Insight[]
) {
  const database = openWritableDatabase();
  try {
    database
      .prepare(
        `INSERT INTO "InsightCache"
           (id, scopeType, scopeId, contentHash, insights, createdAt)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(scopeType, scopeId, contentHash)
         DO UPDATE SET insights = excluded.insights, createdAt = excluded.createdAt`
      )
      .run(
        randomUUID(),
        type,
        scopeId,
        contentHash,
        JSON.stringify(insights),
        Date.now()
      );
  } finally {
    database.close();
  }
}

export async function getOrGenerateInsights(
  type: InsightType,
  scopeId: string,
  stats: InsightStats,
  options: { force?: boolean; generator?: InsightGenerator } = {}
): Promise<CachedInsightResult> {
  const contentHash = statsContentHash(stats);
  if (!options.force) {
    const cached = readCache(type, scopeId, contentHash);
    if (cached) return { insights: cached, cacheHit: true };
  }

  const insights = await (options.generator ?? generateInsights)(stats, type);
  if (insights.length > 0) writeCache(type, scopeId, contentHash, insights);
  return { insights, cacheHit: false };
}
