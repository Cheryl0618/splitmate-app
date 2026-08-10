export const demoUsers = [
  { id: "user-xiaoli", displayName: "小李", email: "xiaoli@splitmate.local" },
  { id: "user-xiaowang", displayName: "小王", email: "xiaowang@splitmate.local" },
  { id: "user-lucy", displayName: "Lucy", email: "lucy@splitmate.local" },
  { id: "user-tom", displayName: "Tom", email: "tom@splitmate.local" },
] as const;

export type SeedSplitMethod = "EQUAL" | "WEIGHTED" | "EXACT";
export type SeedExpenseCategory =
  | "餐饮"
  | "咖啡"
  | "交通"
  | "住宿"
  | "超市"
  | "日用"
  | "娱乐"
  | "其他";

export interface SeedMember {
  id: string;
  userId: string | null;
  displayName: string;
}

export interface SeedExpense {
  id: string;
  description: string;
  amountCents: number;
  paidBy: string;
  createdById: string;
  date: string;
  splitMethod: SeedSplitMethod;
  category: SeedExpenseCategory;
  shares: Record<string, number>;
}

export interface SeedSettlement {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  amountCents: number;
  confirmedAt: string;
}

export interface SeedGroup {
  id: string;
  name: string;
  ownerId: string;
  members: SeedMember[];
  expenses: SeedExpense[];
  settlements: SeedSettlement[];
}

const homeMembers: SeedMember[] = [
  { id: "member-home-xiaoli", userId: "user-xiaoli", displayName: "小李" },
  { id: "member-home-xiaowang", userId: "user-xiaowang", displayName: "小王" },
  { id: "member-home-lucy", userId: "user-lucy", displayName: "Lucy" },
  { id: "member-home-tom", userId: "user-tom", displayName: "Tom" },
  { id: "member-home-emma", userId: null, displayName: "Emma" },
];

const hawaiiMembers: SeedMember[] = [
  { id: "member-hawaii-xiaoli", userId: "user-xiaoli", displayName: "小李" },
  { id: "member-hawaii-xiaowang", userId: "user-xiaowang", displayName: "小王" },
  { id: "member-hawaii-lucy", userId: "user-lucy", displayName: "Lucy" },
  { id: "member-hawaii-tom", userId: "user-tom", displayName: "Tom" },
  { id: "member-hawaii-emma", userId: null, displayName: "Emma" },
];

const HOME = {
  xiaoli: "member-home-xiaoli",
  xiaowang: "member-home-xiaowang",
  lucy: "member-home-lucy",
  tom: "member-home-tom",
  emma: "member-home-emma",
} as const;

const userIdByHomeMemberId: Record<string, string> = {
  [HOME.xiaoli]: "user-xiaoli",
  [HOME.xiaowang]: "user-xiaowang",
  [HOME.lucy]: "user-lucy",
  [HOME.tom]: "user-tom",
  [HOME.emma]: "user-xiaoli",
};

const homeMonths = Array.from({ length: 12 }, (_, index) => {
  const absoluteMonth = 7 + index;
  return {
    year: 2025 + Math.floor(absoluteMonth / 12),
    monthIndex: absoluteMonth % 12,
  };
});

function homeDate(monthOffset: number, day: number) {
  const month = homeMonths[monthOffset];
  return new Date(
    Date.UTC(month.year, month.monthIndex, day, 12, 0, 0)
  ).toISOString();
}

function makeHomeExpense(
  id: string,
  description: string,
  amountCents: number,
  paidBy: string,
  date: string,
  splitMethod: SeedSplitMethod,
  category: SeedExpenseCategory,
  shares: Record<string, number>
): SeedExpense {
  return {
    id,
    description,
    amountCents,
    paidBy,
    createdById: userIdByHomeMemberId[paidBy],
    date,
    splitMethod,
    category,
    shares,
  };
}

const rentPayers = [
  HOME.xiaoli,
  HOME.xiaowang,
  HOME.lucy,
  HOME.xiaoli,
  HOME.lucy,
  HOME.xiaoli,
  HOME.xiaowang,
  HOME.lucy,
  HOME.xiaoli,
  HOME.xiaowang,
  HOME.lucy,
  HOME.xiaoli,
];

const rentExpenses = homeMonths.map((month, index) =>
  makeHomeExpense(
    `home-rent-${String(index + 1).padStart(2, "0")}`,
    `${month.year} 年 ${month.monthIndex + 1} 月房租`,
    90_000,
    rentPayers[index],
    homeDate(index, 2),
    "WEIGHTED",
    "住宿",
    {
      [HOME.xiaoli]: 36_000,
      [HOME.xiaowang]: 27_000,
      [HOME.lucy]: 27_000,
    }
  )
);

const utilityExpenses: SeedExpense[] = [
  makeHomeExpense(
    "home-utility-01",
    "八九月水电费",
    14_500,
    HOME.xiaowang,
    homeDate(0, 6),
    "EXACT",
    "日用",
    { [HOME.xiaowang]: 1_000, [HOME.xiaoli]: 13_500 }
  ),
  makeHomeExpense(
    "home-utility-02",
    "十十一月燃气费",
    14_500,
    HOME.xiaowang,
    homeDate(2, 6),
    "EXACT",
    "日用",
    { [HOME.xiaowang]: 1_000, [HOME.xiaoli]: 13_500 }
  ),
  makeHomeExpense(
    "home-utility-03",
    "十二月与一月电费",
    10_000,
    HOME.xiaoli,
    homeDate(4, 6),
    "EXACT",
    "日用",
    { [HOME.xiaoli]: 1_000, [HOME.lucy]: 9_000 }
  ),
  makeHomeExpense(
    "home-utility-04",
    "二三月水电燃气",
    38_000,
    HOME.xiaowang,
    homeDate(6, 6),
    "EXACT",
    "日用",
    { [HOME.xiaowang]: 1_000, [HOME.lucy]: 27_000, [HOME.tom]: 10_000 }
  ),
  makeHomeExpense(
    "home-utility-05",
    "四五月水费",
    11_000,
    HOME.lucy,
    homeDate(8, 6),
    "EXACT",
    "日用",
    { [HOME.lucy]: 1_000, [HOME.xiaowang]: 10_000 }
  ),
  makeHomeExpense(
    "home-utility-06",
    "六七月燃气费",
    11_000,
    HOME.tom,
    homeDate(10, 6),
    "EXACT",
    "日用",
    { [HOME.tom]: 1_000, [HOME.lucy]: 10_000 }
  ),
];

const pairBlocks: Array<{
  preferred: string;
  counterparty: string;
  category: SeedExpenseCategory;
  description: string;
}> = [
  [HOME.xiaoli, HOME.xiaowang, "超市", "周末超市补货"],
  [HOME.tom, HOME.lucy, "超市", "生鲜和早餐食材"],
  [HOME.xiaoli, HOME.emma, "餐饮", "附近餐厅晚餐"],
  [HOME.tom, HOME.xiaowang, "超市", "厨房常备食材"],
  [HOME.xiaoli, HOME.lucy, "餐饮", "周末外卖"],
  [HOME.tom, HOME.emma, "咖啡", "咖啡豆和牛奶"],
  [HOME.xiaoli, HOME.tom, "超市", "会员店采购"],
  [HOME.tom, HOME.lucy, "餐饮", "下班后聚餐"],
  [HOME.xiaoli, HOME.xiaowang, "超市", "水果零食补货"],
  [HOME.tom, HOME.emma, "娱乐", "周末桌游局"],
  [HOME.xiaoli, HOME.lucy, "餐饮", "生日聚餐"],
  [HOME.tom, HOME.xiaowang, "超市", "火锅食材"],
  [HOME.xiaoli, HOME.emma, "咖啡", "社区咖啡店"],
  [HOME.tom, HOME.lucy, "餐饮", "深夜外卖"],
  [HOME.xiaoli, HOME.tom, "超市", "清晨菜市场"],
  [HOME.tom, HOME.emma, "日用", "清洁用品补充"],
  [HOME.xiaoli, HOME.xiaowang, "餐饮", "周五晚餐"],
  [HOME.tom, HOME.lucy, "超市", "烘焙材料"],
  [HOME.xiaoli, HOME.emma, "交通", "一起打车"],
  [HOME.tom, HOME.xiaowang, "餐饮", "搬家后聚餐"],
].map(([preferred, counterparty, category, description]) => ({
  preferred,
  counterparty,
  category: category as SeedExpenseCategory,
  description,
}));

const frequentExpenses = pairBlocks.flatMap((block, blockIndex) => {
  const monthOffset = Math.floor((blockIndex * 12) / pairBlocks.length);
  const baseDebt = 850 + (blockIndex % 5) * 110;
  const debts = [baseDebt, baseDebt + 170, baseDebt + 320];
  const selfShares = [620, 780, 940];
  const forward = debts.map((debtCents, index) =>
    makeHomeExpense(
      `home-shared-${String(blockIndex + 1).padStart(2, "0")}-${index + 1}`,
      `${block.description} ${index + 1}`,
      debtCents + selfShares[index],
      block.preferred,
      homeDate(monthOffset, [8, 11, 17][index]),
      "EXACT",
      block.category,
      {
        [block.preferred]: selfShares[index],
        [block.counterparty]: debtCents,
      }
    )
  );
  const reverseDebt = debts.reduce((total, value) => total + value, 0);
  return [
    ...forward,
    makeHomeExpense(
      `home-shared-${String(blockIndex + 1).padStart(2, "0")}-4`,
      `${block.description} 月末补单`,
      reverseDebt + 1_200,
      block.counterparty,
      homeDate(monthOffset, 24),
      "EXACT",
      block.category,
      {
        [block.counterparty]: 1_200,
        [block.preferred]: reverseDebt,
      }
    ),
  ];
});

const balanceAnchorExpenses: SeedExpense[] = [
  makeHomeExpense(
    "home-balance-anchor-01",
    "年末超市个人采购",
    10_000,
    HOME.xiaoli,
    homeDate(11, 29),
    "EXACT",
    "超市",
    { [HOME.xiaowang]: 6_000, [HOME.lucy]: 4_000 }
  ),
  makeHomeExpense(
    "home-balance-anchor-02",
    "年末日用品代购",
    6_000,
    HOME.tom,
    homeDate(11, 30),
    "EXACT",
    "日用",
    { [HOME.emma]: 6_000 }
  ),
];

const homeExpenses = [
  ...rentExpenses,
  ...utilityExpenses,
  ...frequentExpenses,
  ...balanceAnchorExpenses,
].sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));

const settlementTrios = [
  [HOME.xiaoli, HOME.xiaowang, HOME.lucy],
  [HOME.xiaoli, HOME.tom, HOME.emma],
  [HOME.xiaoli, HOME.xiaowang, HOME.tom],
  [HOME.xiaoli, HOME.lucy, HOME.emma],
  [HOME.xiaowang, HOME.lucy, HOME.tom],
  [HOME.xiaowang, HOME.tom, HOME.emma],
] as const;

const homeSettlements = homeMonths.flatMap((_, monthOffset) => {
  const pairIndex = Math.floor(monthOffset / 2);
  const trio = settlementTrios[pairIndex];
  const cycle = monthOffset % 2 === 0
    ? [[trio[0], trio[1]], [trio[1], trio[2]], [trio[2], trio[0]]]
    : [[trio[1], trio[0]], [trio[2], trio[1]], [trio[0], trio[2]]];
  return cycle.map(([fromMemberId, toMemberId], index) => ({
    id: `home-settlement-${String(monthOffset + 1).padStart(2, "0")}-${index + 1}`,
    fromMemberId,
    toMemberId,
    amountCents: 2_400 + pairIndex * 200,
    confirmedAt: homeDate(monthOffset, [14, 22, 28][index]),
  }));
});

export const seedGroups: SeedGroup[] = [
  {
    id: "group-home",
    name: "合租",
    ownerId: "user-xiaoli",
    members: homeMembers,
    expenses: homeExpenses,
    settlements: homeSettlements,
  },
  {
    id: "group-hawaii",
    name: "夏威夷旅行",
    ownerId: "user-xiaoli",
    members: hawaiiMembers,
    expenses: [
      {
        id: "hawaii-expense-01",
        description: "往返机票尾款",
        amountCents: 50_000,
        paidBy: "member-hawaii-xiaoli",
        createdById: "user-xiaoli",
        date: "2026-07-10T18:00:00.000Z",
        splitMethod: "EQUAL",
        category: "交通",
        shares: Object.fromEntries(hawaiiMembers.map((member) => [member.id, 10_000])),
      },
      {
        id: "hawaii-expense-02",
        description: "酒店尾款",
        amountCents: 50_000,
        paidBy: "member-hawaii-xiaowang",
        createdById: "user-xiaowang",
        date: "2026-07-11T18:00:00.000Z",
        splitMethod: "EQUAL",
        category: "住宿",
        shares: Object.fromEntries(hawaiiMembers.map((member) => [member.id, 10_000])),
      },
      {
        id: "hawaii-expense-03",
        description: "海边餐厅",
        amountCents: 50_000,
        paidBy: "member-hawaii-lucy",
        createdById: "user-lucy",
        date: "2026-07-12T18:00:00.000Z",
        splitMethod: "EQUAL",
        category: "餐饮",
        shares: Object.fromEntries(hawaiiMembers.map((member) => [member.id, 10_000])),
      },
      {
        id: "hawaii-expense-04",
        description: "环岛 Uber",
        amountCents: 50_000,
        paidBy: "member-hawaii-tom",
        createdById: "user-tom",
        date: "2026-07-13T18:00:00.000Z",
        splitMethod: "EQUAL",
        category: "交通",
        shares: Object.fromEntries(hawaiiMembers.map((member) => [member.id, 10_000])),
      },
      {
        id: "hawaii-expense-05",
        description: "冲浪体验课",
        amountCents: 50_000,
        paidBy: "member-hawaii-emma",
        createdById: "user-xiaoli",
        date: "2026-07-14T18:00:00.000Z",
        splitMethod: "EQUAL",
        category: "其他",
        shares: Object.fromEntries(hawaiiMembers.map((member) => [member.id, 10_000])),
      },
      {
        id: "hawaii-expense-06",
        description: "酒店房型升级",
        amountCents: 12_000,
        paidBy: "member-hawaii-xiaoli",
        createdById: "user-xiaoli",
        date: "2026-07-15T02:00:00.000Z",
        splitMethod: "EXACT",
        category: "住宿",
        shares: { "member-hawaii-xiaowang": 12_000 },
      },
      {
        id: "hawaii-expense-07",
        description: "冲浪装备租赁",
        amountCents: 14_000,
        paidBy: "member-hawaii-tom",
        createdById: "user-tom",
        date: "2026-07-15T18:00:00.000Z",
        splitMethod: "EXACT",
        category: "其他",
        shares: { "member-hawaii-lucy": 8_000, "member-hawaii-emma": 6_000 },
      },
    ],
    settlements: [
      {
        id: "hawaii-settlement-01",
        fromMemberId: "member-hawaii-xiaowang",
        toMemberId: "member-hawaii-xiaoli",
        amountCents: 12_000,
        confirmedAt: "2026-07-15T20:00:00.000Z",
      },
      {
        id: "hawaii-settlement-02",
        fromMemberId: "member-hawaii-emma",
        toMemberId: "member-hawaii-tom",
        amountCents: 6_000,
        confirmedAt: "2026-07-15T21:00:00.000Z",
      },
    ],
  },
];

export const homeGroupSeed = seedGroups[0];
