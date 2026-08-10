import {
  computeRelationship,
  type RelationshipExpense,
  type RelationshipSettlement,
} from "@/lib/relationship";
import { openDatabase } from "@/server/database";

interface RelationshipPageBase {
  groupId: string;
  groupName: string;
  targetMemberId: string;
  targetMemberName: string;
}

export type RelationshipPageData =
  | (RelationshipPageBase & { state: "not-member" })
  | (RelationshipPageBase & { state: "same-member" })
  | (RelationshipPageBase & { state: "no-shared" })
  | {
      state: "ready";
      groupId: string;
      groupName: string;
      targetMemberId: string;
      targetMemberName: string;
      overview: {
        relationshipDuration: string;
        totalSharedCents: number;
        sharedExpenseCount: number;
      };
      recentBurden: {
        fromMonth: string;
        toMonth: string;
        aRatioLabel: string;
        bRatioLabel: string;
        aWidth: string;
        bWidth: string;
        aCents: number;
        bCents: number;
      };
      topCategories: Array<{ category: string; cents: number; count: number }>;
      settlementHabits: {
        avgSettleDaysLabel: string;
        settledExpenseCount: number;
        aPaidCount: number;
        bPaidCount: number;
        aPaidCents: number;
        bPaidCents: number;
      };
    };

interface MemberRow {
  id: string;
  userId: string | null;
  displayName: string;
}

interface ExpenseRow {
  id: string;
  amountCents: number;
  paidBy: string;
  date: number | string;
  category: string;
}

interface ShareRow {
  expenseId: string;
  memberId: string;
  amountCents: number;
}

interface SettlementRow {
  fromMemberId: string;
  toMemberId: string;
  confirmedAt: number | string;
}

function relationshipDuration(firstExpenseAt: Date) {
  const now = new Date();
  const months = Math.max(
    1,
    (now.getUTCFullYear() - firstExpenseAt.getUTCFullYear()) * 12 +
      now.getUTCMonth() -
      firstExpenseAt.getUTCMonth()
  );
  if (months < 12) return `${months} 个月`;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return remainingMonths > 0 ? `${years} 年 ${remainingMonths} 个月` : `${years} 年`;
}

function percentage(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function getRelationshipPageData(
  groupId: string,
  memberId: string,
  currentUserId: string
): RelationshipPageData | null {
  const database = openDatabase();

  try {
    const group = database
      .prepare(`SELECT id, name FROM "Group" WHERE id = ?`)
      .get(groupId) as { id: string; name: string } | undefined;
    if (!group) return null;

    const memberRows = database
      .prepare(
        `SELECT id, userId, displayName
         FROM "GroupMember"
         WHERE groupId = ?
         ORDER BY createdAt, id`
      )
      .all(groupId) as MemberRow[];
    const targetMember = memberRows.find((member) => member.id === memberId);
    if (!targetMember) return null;

    const base = {
      groupId: group.id,
      groupName: group.name,
      targetMemberId: targetMember.id,
      targetMemberName: targetMember.displayName,
    };
    const currentMember = memberRows.find(
      (member) => member.userId === currentUserId
    );
    if (!currentMember) return { state: "not-member", ...base };
    if (currentMember.id === targetMember.id) {
      return { state: "same-member", ...base };
    }

    const expenseRows = database
      .prepare(
        `SELECT id, amountCents, paidBy, date, category
         FROM "Expense"
         WHERE groupId = ?
         ORDER BY date, createdAt, id`
      )
      .all(groupId) as ExpenseRow[];
    const shareRows = database
      .prepare(
        `SELECT share.expenseId, share.memberId, share.amountCents
         FROM "ExpenseShare" AS share
         INNER JOIN "Expense" AS expense ON expense.id = share.expenseId
         WHERE expense.groupId = ?`
      )
      .all(groupId) as ShareRow[];
    const settlementRows = database
      .prepare(
        `SELECT fromMemberId, toMemberId, confirmedAt
         FROM "Settlement"
         WHERE groupId = ?
         ORDER BY confirmedAt, id`
      )
      .all(groupId) as SettlementRow[];

    const sharesByExpense = new Map<string, Record<string, number>>();
    for (const share of shareRows) {
      const shares = sharesByExpense.get(share.expenseId) ?? {};
      shares[share.memberId] = share.amountCents;
      sharesByExpense.set(share.expenseId, shares);
    }

    const expenses: RelationshipExpense[] = expenseRows.map((expense) => ({
      id: expense.id,
      amountCents: expense.amountCents,
      paidBy: expense.paidBy,
      date: new Date(expense.date).toISOString(),
      category: expense.category,
      shares: sharesByExpense.get(expense.id) ?? {},
    }));
    const settlements: RelationshipSettlement[] = settlementRows.map(
      (settlement) => ({
        fromMemberId: settlement.fromMemberId,
        toMemberId: settlement.toMemberId,
        confirmedAt: new Date(settlement.confirmedAt).toISOString(),
      })
    );
    const stats = computeRelationship(
      expenses,
      settlements,
      currentMember.id,
      targetMember.id
    );
    if (stats.sharedExpenseCount === 0) {
      return { state: "no-shared", ...base };
    }

    const recentMonths = stats.monthlyTrend.slice(-3);
    const recentACents = recentMonths.reduce(
      (total, month) => total + month.aCents,
      0
    );
    const recentBCents = recentMonths.reduce(
      (total, month) => total + month.bCents,
      0
    );
    const recentTotalCents = recentACents + recentBCents;
    const recentARatio = recentTotalCents > 0 ? recentACents / recentTotalCents : 0;
    const recentBRatio = recentTotalCents > 0 ? 1 - recentARatio : 0;

    return {
      state: "ready",
      ...base,
      overview: {
        relationshipDuration: relationshipDuration(stats.firstSharedExpenseAt),
        totalSharedCents: stats.totalSharedCents,
        sharedExpenseCount: stats.sharedExpenseCount,
      },
      recentBurden: {
        fromMonth: recentMonths[0]?.month ?? "",
        toMonth: recentMonths.at(-1)?.month ?? "",
        aRatioLabel: percentage(recentARatio),
        bRatioLabel: percentage(recentBRatio),
        aWidth: percentage(recentARatio),
        bWidth: percentage(recentBRatio),
        aCents: recentACents,
        bCents: recentBCents,
      },
      topCategories: stats.topCategories.map(({ category, cents, count }) => ({
        category,
        cents,
        count,
      })),
      settlementHabits: {
        avgSettleDaysLabel:
          stats.settledExpenseCount > 0
            ? `${stats.avgSettleDays.toFixed(1)} 天`
            : "尚无记录",
        settledExpenseCount: stats.settledExpenseCount,
        aPaidCount: stats.aPaidCount,
        bPaidCount: stats.bPaidCount,
        aPaidCents: stats.aPaidCents,
        bPaidCents: stats.bPaidCents,
      },
    };
  } finally {
    database.close();
  }
}
