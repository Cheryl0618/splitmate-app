import type { Insight } from "../insights";

export const groupInsightsFixture: Insight[] = [
  { text: "你们的超市消费在分类中占比最高", kind: "pattern" },
  { text: "你们最近三个月的月度消费保持平稳", kind: "trend" },
  { text: "你们可以定期回顾垫付与承担的差异", kind: "suggestion" },
];

export const relationshipInsightsFixture: Insight[] = [
  { text: "你们最近三个月的承担比例较为接近", kind: "pattern" },
  { text: "你们的共同消费主要集中在超市", kind: "trend" },
  { text: "你们可以继续保持当前的结算节奏", kind: "suggestion" },
];

export const invalidInsightsFixture = { insights: "invalid" };
