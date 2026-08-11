export const textExpenseFixture = {
  merchantName: "今晚聚餐",
  category: "餐饮",
  totalYuan: 238,
  items: undefined,
  paidByMemberId: "member-home-xiaoli",
  participantMemberIds: [
    "member-home-xiaoli",
    "member-home-xiaowang",
    "member-home-lucy",
    "member-home-tom",
  ],
  note: "今晚聚餐；小王没喝酒，Lucy 吃了龙虾，Tom 只喝咖啡",
  unresolvedNames: [],
  confidence: "high",
} as const;

export const textExpenseFixtureEn = {
  ...textExpenseFixture,
  merchantName: "Dinner",
  note: "Dinner last night; Wang did not drink, Lucy had lobster, and Tom only had coffee",
} as const;
