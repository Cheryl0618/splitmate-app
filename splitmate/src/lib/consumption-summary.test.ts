import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { computeGroupStats } from "./group-stats";
import {
  generateInsights,
  normalizeInsights,
} from "./consumption-summary";
import { homeGroupSeed } from "./seed-data";
import { formatInsightText } from "./insight-format";

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

  it("returns English summaries for an English interface", async () => {
    const insights = await generateInsights(stats, "group", "en");
    expect(insights).toHaveLength(3);
    expect(insights.every((insight) => !/[一-龥]/.test(insight.text))).toBe(true);
  });

  it("returns an empty array for malformed model output", async () => {
    vi.stubEnv("MOCK_INSIGHTS_INVALID", "true");
    await expect(generateInsights(stats, "group")).resolves.toEqual([]);
  });

  it("formats one or more amount placeholders with the supplied currency", () => {
    expect(
      formatInsightText(
        {
          text: "你们本月合计 {amount}",
          kind: "fact",
          relatedCents: [276_000],
        },
        "CNY"
      )
    ).toBe(`你们本月合计 \u00a52,760.00`);
    expect(
      formatInsightText(
        {
          text: "本月 {amount1}，上月 {amount2}",
          kind: "trend",
          relatedCents: [276_000, 310_000],
        },
        "USD"
      )
    ).toBe(`本月 \u00242,760.00，上月 \u00243,100.00`);
  });

  it("hides an insight when placeholders and amounts do not match", () => {
    expect(
      formatInsightText(
        { text: "合计 {amount1}", kind: "fact", relatedCents: [276_000] },
        "CNY"
      )
    ).toBeNull();
    expect(
      formatInsightText(
        { text: "合计 {amount}", kind: "fact", relatedCents: [] },
        "CNY"
      )
    ).toBeNull();
    expect(
      formatInsightText(
        {
          text: "合计 \u00a52760.00，另计 {amount}",
          kind: "fact",
          relatedCents: [276_000],
        },
        "CNY"
      )
    ).toBeNull();
  });

  it("rejects the legacy scalar relatedCents shape", () => {
    expect(
      normalizeInsights({
        insights: [
          { text: "合计 {amount}", kind: "fact", relatedCents: 276_000 },
          { text: "本月共有 7 笔", kind: "fact", relatedCents: null },
        ],
      })
    ).toEqual([]);
  });
});
