import type { ResponseFormatTextJSONSchemaConfig } from "openai/resources/responses/responses";

import {
  groupInsightsFixture,
  groupInsightsFixtureEn,
  invalidInsightsFixture,
  relationshipInsightsFixture,
  relationshipInsightsFixtureEn,
} from "./__fixtures__/consumption-summary";
import type { GroupStats } from "./group-stats";
import { requestStructuredOutput } from "./parse-expense";
import type { RelationshipStats } from "./relationship";
import type { Locale } from "@/i18n/context";

export type InsightKind = "fact" | "trend";
export type InsightType = "group" | "relationship";

export interface Insight {
  text: string;
  kind: InsightKind;
  relatedCents?: number[];
}

const INSIGHT_KINDS = new Set<InsightKind>(["fact", "trend"]);

const INSIGHTS_RESPONSE_FORMAT: ResponseFormatTextJSONSchemaConfig = {
  type: "json_schema",
  name: "expense_summary",
  strict: true,
  description: "Up to four factual insights based only on aggregate expense statistics.",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      insights: {
        type: "array",
        maxItems: 4,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            text: {
              type: "string",
              maxLength: 40,
              description: "One sentence in the requested UI language, no more than 40 characters.",
            },
            kind: {
              type: "string",
              enum: ["fact", "trend"],
            },
            relatedCents: {
              type: ["array", "null"],
              maxItems: 4,
              items: {
                type: "integer",
              },
              description:
                "Exact integer-cent values copied from allowedRelatedCents, in placeholder order, or null when text has no amount.",
            },
          },
          required: ["text", "kind", "relatedCents"],
        },
      },
    },
    required: ["insights"],
  },
};

function yuan(cents: number) {
  return (cents / 100).toFixed(2);
}

function groupPayload(stats: GroupStats) {
  return {
    period: {
      start: stats.periodStart.toISOString().slice(0, 10),
      end: stats.periodEnd.toISOString().slice(0, 10),
    },
    totalYuan: yuan(stats.totalCents),
    expenseCount: stats.expenseCount,
    memberCount: stats.memberCount,
    categories: stats.byCategory.map((entry) => ({
      category: entry.category,
      amountYuan: yuan(entry.cents),
      count: entry.count,
      sharePercent: (entry.share * 100).toFixed(2),
    })),
    months: stats.byMonth.map((entry) => ({
      month: entry.month,
      amountYuan: yuan(entry.cents),
      count: entry.count,
    })),
    members: stats.byMember.map((entry, index) => ({
      member: `成员${index + 1}`,
      paidYuan: yuan(entry.paidCents),
      burdenYuan: yuan(entry.burdenCents),
      paidCount: entry.paidCount,
    })),
    avgExpenseYuan: yuan(stats.avgExpenseCents),
    largestExpenseYuan: yuan(stats.largestExpense.cents),
    activeDays: stats.activeDays,
    settlementCount: stats.settlementCount,
    allowedRelatedCents: [
      stats.totalCents,
      stats.avgExpenseCents,
      stats.largestExpense.cents,
      ...stats.byCategory.map((entry) => entry.cents),
      ...stats.byMonth.map((entry) => entry.cents),
      ...stats.byMember.flatMap((entry) => [entry.paidCents, entry.burdenCents]),
    ],
  };
}

function relationshipPayload(stats: RelationshipStats) {
  return {
    sharedExpenseCount: stats.sharedExpenseCount,
    totalSharedYuan: yuan(stats.totalSharedCents),
    paid: {
      aCount: stats.aPaidCount,
      bCount: stats.bPaidCount,
      aYuan: yuan(stats.aPaidCents),
      bYuan: yuan(stats.bPaidCents),
    },
    burdenPercent: {
      a: (stats.aBurdenRatio * 100).toFixed(2),
      b: (stats.bBurdenRatio * 100).toFixed(2),
    },
    avgSettleDays: Number(stats.avgSettleDays.toFixed(2)),
    settledExpenseCount: stats.settledExpenseCount,
    categories: stats.topCategories.map((entry) => ({
      category: entry.category,
      amountYuan: yuan(entry.cents),
      count: entry.count,
    })),
    months: stats.monthlyTrend.map((entry) => ({
      month: entry.month,
      aBurdenYuan: yuan(entry.aCents),
      bBurdenYuan: yuan(entry.bCents),
    })),
    allowedRelatedCents: [
      stats.totalSharedCents,
      stats.aPaidCents,
      stats.bPaidCents,
      ...stats.topCategories.map((entry) => entry.cents),
      ...stats.monthlyTrend.flatMap((entry) => [entry.aCents, entry.bCents]),
    ],
  };
}

function buildPrompt(stats: GroupStats | RelationshipStats, type: InsightType, locale: Locale) {
  const payload = type === "group"
    ? groupPayload(stats as GroupStats)
    : relationshipPayload(stats as RelationshipStats);

  return [
    "You edit objective spending summaries for a shared-expense product.",
    `Write 2 to 4 summaries in ${locale === "zh" ? "Simplified Chinese" : "English"}, ordered by importance.`,
    "Keep each text at 40 characters or fewer. Address the people as '你们' in Chinese or 'you' in English; never call them users.",
    "State only facts or trends directly supported by the aggregate statistics. Never speculate about causes.",
    "Never give advice, make value judgments, assess fairness, or comment on anyone's spending habits.",
    "Relationship summaries must remain neutral and must not praise either person.",
    "Every number must be copied from the input. Do not calculate, infer, round, or invent numbers.",
    "Never put a currency symbol or amount literal in text. Use an amount placeholder instead.",
    "Use {amount} for one amount. For multiple amounts, use {amount1}, {amount2} in continuous order.",
    "relatedCents must list exact integer values copied from allowedRelatedCents in placeholder order.",
    "Return null relatedCents when text has no amount, and never attach amounts without placeholders.",
    `Summary type: ${type}`,
    `Aggregate statistics: ${JSON.stringify(payload)}`,
  ].join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function normalizeInsights(
  value: unknown,
  allowedRelatedCents?: Set<number>
): Insight[] {
  if (!isRecord(value) || !Array.isArray(value.insights)) return [];

  const insights: Insight[] = [];
  for (const item of value.insights.slice(0, 4)) {
    if (!isRecord(item)) return [];
    const text = typeof item.text === "string" ? item.text.trim() : "";
    if (
      !text ||
      Array.from(text).length > 40 ||
      !INSIGHT_KINDS.has(item.kind as InsightKind)
    ) {
      return [];
    }
    const relatedCents = item.relatedCents;
    const hasRelatedCents = Array.isArray(relatedCents);
    const hasValidRelatedCents =
      hasRelatedCents &&
      relatedCents.length <= 4 &&
      relatedCents.every(
        (cents) =>
          Number.isSafeInteger(cents) &&
          (!allowedRelatedCents || allowedRelatedCents.has(cents as number))
      );
    if (relatedCents !== null && relatedCents !== undefined && !hasValidRelatedCents) {
      return [];
    }
    insights.push({
      text,
      kind: item.kind as InsightKind,
      ...(hasValidRelatedCents ? { relatedCents: relatedCents as number[] } : {}),
    });
  }
  return insights.length >= 2 ? insights : [];
}

function allowedCents(stats: GroupStats | RelationshipStats, type: InsightType) {
  const payload = type === "group"
    ? groupPayload(stats as GroupStats)
    : relationshipPayload(stats as RelationshipStats);
  return new Set(payload.allowedRelatedCents);
}

export async function generateInsights(
  stats: GroupStats | RelationshipStats,
  type: InsightType,
  locale: Locale = "zh"
): Promise<Insight[]> {
  try {
    const response = process.env.MOCK_AI === "true"
      ? process.env.MOCK_INSIGHTS_INVALID === "true"
        ? invalidInsightsFixture
        : {
            insights:
              type === "group"
                ? locale === "zh" ? groupInsightsFixture((stats as GroupStats).totalCents) : groupInsightsFixtureEn((stats as GroupStats).totalCents)
                : locale === "zh" ? relationshipInsightsFixture(
                    (stats as RelationshipStats).totalSharedCents
                  ) : relationshipInsightsFixtureEn((stats as RelationshipStats).totalSharedCents),
          }
      : await requestStructuredOutput(buildPrompt(stats, type, locale), INSIGHTS_RESPONSE_FORMAT);
    return normalizeInsights(response, allowedCents(stats, type));
  } catch (error) {
    console.error("[generateConsumptionSummary] failed", { type, error });
    return [];
  }
}
