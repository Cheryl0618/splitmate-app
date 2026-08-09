export const demoUsers = [
  { id: "user-xiaoli", displayName: "小李", email: "xiaoli@splitmate.local" },
  { id: "user-xiaowang", displayName: "小王", email: "xiaowang@splitmate.local" },
  { id: "user-lucy", displayName: "Lucy", email: "lucy@splitmate.local" },
  { id: "user-tom", displayName: "Tom", email: "tom@splitmate.local" },
] as const;

export type SeedSplitMethod = "EQUAL" | "WEIGHTED" | "EXACT";

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
  category: string;
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

export const seedGroups: SeedGroup[] = [
  {
    id: "group-home",
    name: "合租",
    ownerId: "user-xiaoli",
    members: homeMembers,
    expenses: [
      {
        id: "home-expense-01",
        description: "一月房租及押金",
        amountCents: 120_000,
        paidBy: "member-home-xiaoli",
        createdById: "user-xiaoli",
        date: "2026-01-05T12:00:00.000Z",
        splitMethod: "WEIGHTED",
        category: "住宿",
        shares: {
          "member-home-xiaoli": 48_000,
          "member-home-xiaowang": 36_000,
          "member-home-lucy": 36_000,
        },
      },
      {
        id: "home-expense-02",
        description: "二月房租",
        amountCents: 90_000,
        paidBy: "member-home-xiaowang",
        createdById: "user-xiaowang",
        date: "2026-02-05T12:00:00.000Z",
        splitMethod: "WEIGHTED",
        category: "住宿",
        shares: {
          "member-home-xiaoli": 36_000,
          "member-home-xiaowang": 27_000,
          "member-home-lucy": 27_000,
        },
      },
      {
        id: "home-expense-03",
        description: "三月房租",
        amountCents: 90_000,
        paidBy: "member-home-lucy",
        createdById: "user-lucy",
        date: "2026-03-05T12:00:00.000Z",
        splitMethod: "WEIGHTED",
        category: "住宿",
        shares: {
          "member-home-xiaoli": 36_000,
          "member-home-xiaowang": 27_000,
          "member-home-lucy": 27_000,
        },
      },
      {
        id: "home-expense-04",
        description: "一月水费",
        amountCents: 6_400,
        paidBy: "member-home-xiaoli",
        createdById: "user-xiaoli",
        date: "2026-01-10T12:00:00.000Z",
        splitMethod: "EQUAL",
        category: "日用",
        shares: { "member-home-xiaoli": 3_200, "member-home-xiaowang": 3_200 },
      },
      {
        id: "home-expense-05",
        description: "一月燃气费",
        amountCents: 6_400,
        paidBy: "member-home-xiaowang",
        createdById: "user-xiaowang",
        date: "2026-01-18T12:00:00.000Z",
        splitMethod: "EQUAL",
        category: "日用",
        shares: { "member-home-xiaowang": 3_200, "member-home-lucy": 3_200 },
      },
      {
        id: "home-expense-06",
        description: "一月电费",
        amountCents: 6_400,
        paidBy: "member-home-lucy",
        createdById: "user-lucy",
        date: "2026-01-25T12:00:00.000Z",
        splitMethod: "EQUAL",
        category: "日用",
        shares: { "member-home-lucy": 3_200, "member-home-tom": 3_200 },
      },
      {
        id: "home-expense-07",
        description: "二月超市补货",
        amountCents: 6_400,
        paidBy: "member-home-tom",
        createdById: "user-tom",
        date: "2026-02-08T12:00:00.000Z",
        splitMethod: "EQUAL",
        category: "餐饮",
        shares: { "member-home-xiaoli": 3_200, "member-home-tom": 3_200 },
      },
      {
        id: "home-expense-08",
        description: "二月清洁用品",
        amountCents: 3_800,
        paidBy: "member-home-xiaoli",
        createdById: "user-xiaoli",
        date: "2026-02-14T12:00:00.000Z",
        splitMethod: "EQUAL",
        category: "日用",
        shares: { "member-home-xiaoli": 1_900, "member-home-emma": 1_900 },
      },
      {
        id: "home-expense-09",
        description: "二月厨房用品",
        amountCents: 3_800,
        paidBy: "member-home-emma",
        createdById: "user-xiaoli",
        date: "2026-02-20T12:00:00.000Z",
        splitMethod: "EQUAL",
        category: "日用",
        shares: { "member-home-xiaoli": 1_900, "member-home-emma": 1_900 },
      },
      {
        id: "home-expense-10",
        description: "三月电费",
        amountCents: 7_600,
        paidBy: "member-home-tom",
        createdById: "user-tom",
        date: "2026-03-12T12:00:00.000Z",
        splitMethod: "EQUAL",
        category: "日用",
        shares: { "member-home-tom": 3_800, "member-home-emma": 3_800 },
      },
      {
        id: "home-expense-11",
        description: "三月燃气费",
        amountCents: 7_600,
        paidBy: "member-home-emma",
        createdById: "user-xiaoli",
        date: "2026-03-18T12:00:00.000Z",
        splitMethod: "EQUAL",
        category: "日用",
        shares: { "member-home-tom": 3_800, "member-home-emma": 3_800 },
      },
      {
        id: "home-expense-12",
        description: "三月超市个人采购",
        amountCents: 10_000,
        paidBy: "member-home-xiaoli",
        createdById: "user-xiaoli",
        date: "2026-03-22T12:00:00.000Z",
        splitMethod: "EXACT",
        category: "餐饮",
        shares: { "member-home-xiaowang": 6_000, "member-home-lucy": 4_000 },
      },
      {
        id: "home-expense-13",
        description: "三月日用品代购",
        amountCents: 6_000,
        paidBy: "member-home-tom",
        createdById: "user-tom",
        date: "2026-03-28T12:00:00.000Z",
        splitMethod: "EXACT",
        category: "日用",
        shares: { "member-home-emma": 6_000 },
      },
    ],
    settlements: [],
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
