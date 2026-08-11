import type { Insight } from "../consumption-summary";

export function groupInsightsFixture(totalCents: number): Insight[] {
  return [
    { text: "你们区间内的支出合计 {amount}", kind: "fact", relatedCents: [totalCents] },
    { text: "你们最近三个月的月度消费保持平稳", kind: "trend" },
    { text: "你们共有五位成员参与共同账单", kind: "fact" },
  ];
}

export function relationshipInsightsFixture(totalSharedCents: number): Insight[] {
  return [
    { text: "你们的共同消费合计 {amount}", kind: "fact", relatedCents: [totalSharedCents] },
    { text: "你们最近三个月均有共同消费", kind: "trend" },
    { text: "你们已有多笔共同账单完成结算", kind: "fact" },
  ];
}

export function groupInsightsFixtureEn(totalCents: number): Insight[] {
  return [
    { text: "Period spending totals {amount}", kind: "fact", relatedCents: [totalCents] },
    { text: "Monthly spending was steady for 3 months", kind: "trend" },
    { text: "Five members shared group expenses", kind: "fact" },
  ];
}

export function relationshipInsightsFixtureEn(totalSharedCents: number): Insight[] {
  return [
    { text: "Your shared spending totals {amount}", kind: "fact", relatedCents: [totalSharedCents] },
    { text: "Shared expenses appeared in all 3 months", kind: "trend" },
    { text: "Multiple shared expenses are settled", kind: "fact" },
  ];
}

export const invalidInsightsFixture = { insights: "invalid" };
