import type { ResponseFormatTextJSONSchemaConfig } from "openai/resources/responses/responses";

import {
  groupInsightsFixture,
  invalidInsightsFixture,
  relationshipInsightsFixture,
} from "./__fixtures__/consumption-summary";
import type { GroupStats } from "./group-stats";
import { requestStructuredOutput } from "./parse-expense";
import type { RelationshipStats } from "./relationship";

export type InsightKind = "fact" | "trend";
export type InsightType = "group" | "relationship";

export interface Insight {
  text: string;
  kind: InsightKind;
  relatedCents?: number;
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
              description: "One Chinese sentence of no more than 40 characters.",
            },
            kind: {
              type: "string",
              enum: ["fact", "trend"],
            },
            relatedCents: {
              type: ["integer", "null"],
              description:
                "An exact integer-cent value copied from allowedRelatedCents, or null.",
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

function buildPrompt(stats: GroupStats | RelationshipStats, type: InsightType) {
  const payload = type === "group"
    ? groupPayload(stats as GroupStats)
    : relationshipPayload(stats as RelationshipStats);

  return [
    "你是共享记账产品的消费总结编辑。",
    "只根据下方聚合统计生成 2 到 4 条中文客观总结，并按重要性排序。",
    "每条 text 不超过 40 个汉字，使用第二人称“你们”，不要使用“用户”。",
    "只陈述数据直接支持的事实或变化趋势，不推测任何原因。",
    "禁止任何建议，例如“可以考虑”或“建议你们”。",
    "禁止任何评价，例如“偏高”“过多”“不太合理”。",
    "禁止判断分账是否公平，也禁止评论任何个人的消费习惯。",
    "关系总结必须保持中立，不暗示任何一方更值得肯定。",
    "所有数字必须逐字取自输入，不得自行计算、推导、四舍五入或编造。",
    "金额一律写成 ¥123.45 形式，保留两位小数。",
    "relatedCents 只能原样复制 allowedRelatedCents 中的整数；没有合适金额就返回 null。",
    "好例子：你们最近三个月共 42 笔支出，合计 ¥3820.00。",
    "好例子：你们本月支出比上月减少 ¥520.00。",
    "坏例子：你们在咖啡上花得较多，可以考虑控制。",
    "坏例子：你承担的比例偏高。",
    `统计类型：${type}`,
    `聚合统计：${JSON.stringify(payload)}`,
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
    const hasValidRelatedCents =
      Number.isSafeInteger(relatedCents) &&
      (!allowedRelatedCents || allowedRelatedCents.has(relatedCents as number));
    insights.push({
      text,
      kind: item.kind as InsightKind,
      ...(hasValidRelatedCents ? { relatedCents: relatedCents as number } : {}),
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
  type: InsightType
): Promise<Insight[]> {
  try {
    const response = process.env.MOCK_AI === "true"
      ? process.env.MOCK_INSIGHTS_INVALID === "true"
        ? invalidInsightsFixture
        : { insights: type === "group" ? groupInsightsFixture : relationshipInsightsFixture }
      : await requestStructuredOutput(buildPrompt(stats, type), INSIGHTS_RESPONSE_FORMAT);
    return normalizeInsights(response, allowedCents(stats, type));
  } catch (error) {
    console.error("[generateConsumptionSummary] failed", { type, error });
    return [];
  }
}
