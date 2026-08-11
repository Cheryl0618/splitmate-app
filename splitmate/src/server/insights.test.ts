import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { computeGroupStats } from "@/lib/group-stats";
import { generateInsights } from "@/lib/consumption-summary";
import { homeGroupSeed } from "@/lib/seed-data";
import { openWritableDatabase } from "@/server/database";
import { getOrGenerateInsights } from "@/server/insights";

const TEST_SCOPE_ID = "test:insight-cache";

function clearTestCache() {
  const database = openWritableDatabase();
  try {
    database
      .prepare(`DELETE FROM "InsightCache" WHERE scopeId = ?`)
      .run(TEST_SCOPE_ID);
  } finally {
    database.close();
  }
}

describe("insight cache", () => {
  const stats = computeGroupStats(
    homeGroupSeed.expenses,
    homeGroupSeed.settlements,
    homeGroupSeed.members
  );

  beforeEach(() => {
    vi.stubEnv("MOCK_AI", "true");
    clearTestCache();
  });

  afterEach(() => {
    clearTestCache();
    vi.unstubAllEnvs();
  });

  it("reuses cached insights when aggregate statistics have not changed", async () => {
    let generationCount = 0;
    const generator: typeof generateInsights = async (input, type) => {
      generationCount += 1;
      return generateInsights(input, type);
    };

    const first = await getOrGenerateInsights("group", TEST_SCOPE_ID, stats, {
      generator,
    });
    const second = await getOrGenerateInsights("group", TEST_SCOPE_ID, stats, {
      generator,
    });

    expect(first.cacheHit).toBe(false);
    expect(second.cacheHit).toBe(true);
    expect(second.insights).toEqual(first.insights);
    expect(generationCount).toBe(1);
  });

  it("keeps Chinese and English summaries in separate cache entries", async () => {
    let generationCount = 0;
    const generator: typeof generateInsights = async (input, type, locale) => {
      generationCount += 1;
      return generateInsights(input, type, locale);
    };
    await getOrGenerateInsights("group", TEST_SCOPE_ID, stats, { generator, locale: "zh" });
    await getOrGenerateInsights("group", TEST_SCOPE_ID, stats, { generator, locale: "en" });
    expect(generationCount).toBe(2);
  });
});
