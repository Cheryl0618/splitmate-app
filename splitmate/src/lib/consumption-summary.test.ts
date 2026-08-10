import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { computeGroupStats } from "./group-stats";
import { generateInsights } from "./consumption-summary";
import { homeGroupSeed } from "./seed-data";

describe("generateInsights", () => {
  const stats = computeGroupStats(
    homeGroupSeed.expenses,
    homeGroupSeed.settlements,
    homeGroupSeed.members
  );

  beforeEach(() => {
    vi.stubEnv("MOCK_AI", "true");
    vi.stubEnv("MOCK_INSIGHTS_INVALID", "false");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns fixture insights with the expected shape", async () => {
    const fetchSpy = vi.fn(() => {
      throw new Error("mock mode must not use the network");
    });
    vi.stubGlobal("fetch", fetchSpy);

    const insights = await generateInsights(stats, "group");

    expect(insights.length).toBeGreaterThanOrEqual(2);
    expect(insights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: expect.any(String),
          kind: expect.stringMatching(/^(fact|trend)$/),
        }),
      ])
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("never returns more than four insights", async () => {
    await expect(generateInsights(stats, "group")).resolves.toHaveLength(3);
  });

  it("returns an empty array for malformed model output", async () => {
    vi.stubEnv("MOCK_INSIGHTS_INVALID", "true");
    await expect(generateInsights(stats, "group")).resolves.toEqual([]);
  });
});
