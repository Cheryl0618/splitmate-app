import type { Insight } from "../consumption-summary";

export const groupInsightsFixture: Insight[] = [
  { text: "你们的超市消费在分类中占比最高", kind: "fact" },
  { text: "你们最近三个月的月度消费保持平稳", kind: "trend" },
  { text: "你们共有五位成员参与共同账单", kind: "fact" },
];

export const relationshipInsightsFixture: Insight[] = [
  { text: "你们最近三个月均有共同消费", kind: "fact" },
  { text: "你们的共同消费主要集中在超市", kind: "trend" },
  { text: "你们已有多笔共同账单完成结算", kind: "fact" },
];

export const invalidInsightsFixture = { insights: "invalid" };
