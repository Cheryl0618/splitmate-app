export const receiptFixture = {
  merchantName: "Whole Foods",
  category: "超市",
  totalYuan: 120,
  taxYuan: 8,
  tipYuan: 0,
  items: [
    {
      name: "牛奶",
      priceYuan: 18,
      memberIds: ["member-home-xiaoli", "member-home-lucy"],
    },
    {
      name: "咖啡豆",
      priceYuan: 32,
      memberIds: ["member-home-tom"],
    },
    {
      name: "水果",
      priceYuan: 26,
      memberIds: ["member-home-xiaoli", "member-home-xiaowang"],
    },
    {
      name: "清洁剂",
      priceYuan: 16,
      memberIds: ["member-home-emma"],
    },
    {
      name: "面包和鸡蛋",
      priceYuan: 20,
      memberIds: [
        "member-home-xiaoli",
        "member-home-xiaowang",
        "member-home-lucy",
        "member-home-tom",
        "member-home-emma",
      ],
    },
  ],
  paidByMemberId: "member-home-xiaoli",
  participantMemberIds: [
    "member-home-xiaoli",
    "member-home-xiaowang",
    "member-home-lucy",
    "member-home-tom",
    "member-home-emma",
  ],
  note: "超市采购",
  unresolvedNames: [],
  confidence: "high",
} as const;

export const receiptFixtureEn = {
  ...receiptFixture,
  items: [
    { ...receiptFixture.items[0], name: "Milk" },
    { ...receiptFixture.items[1], name: "Coffee beans" },
    { ...receiptFixture.items[2], name: "Fruit" },
    { ...receiptFixture.items[3], name: "Cleaning supplies" },
    { ...receiptFixture.items[4], name: "Bread and eggs" },
  ],
  note: "Grocery run",
} as const;
