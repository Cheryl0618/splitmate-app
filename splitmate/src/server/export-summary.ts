import { optimalSettle } from "@/lib/settlement";
import type { Currency } from "@/lib/currency";
import { getGroupBalances } from "@/server/balances";
import { openDatabase } from "@/server/database";

export interface ExportSummaryData {
  groupId: string;
  groupName: string;
  currency: Currency;
  periodStart: string | null;
  periodEnd: string | null;
  totalCents: number;
  expenseCount: number;
  balances: Array<{
    memberId: string;
    userId: string | null;
    displayName: string;
    amountCents: number;
  }>;
  transfers: Array<{
    fromMemberId: string;
    fromName: string;
    toMemberId: string;
    toName: string;
    amountCents: number;
  }>;
}

interface GroupRow {
  id: string;
  name: string;
  currency: Currency;
}

interface ExpenseStatsRow {
  periodStart: number | string | null;
  periodEnd: number | string | null;
  totalCents: number | null;
  expenseCount: number;
}

export function getExportSummaryData(groupId: string): ExportSummaryData | null {
  const database = openDatabase();
  try {
    const group = database
      .prepare(`SELECT id, name, currency FROM "Group" WHERE id = ?`)
      .get(groupId) as GroupRow | undefined;
    if (!group) return null;
    const stats = database
      .prepare(
        `SELECT MIN(date) AS periodStart,
                MAX(date) AS periodEnd,
                COALESCE(SUM(amountCents), 0) AS totalCents,
                COUNT(*) AS expenseCount
         FROM "Expense"
         WHERE groupId = ?`
      )
      .get(groupId) as ExpenseStatsRow;
    const balances = getGroupBalances(groupId);
    const names = new Map(
      balances.map((member) => [member.memberId, member.displayName])
    );
    const balanceMap = new Map(
      balances.map((member) => [member.memberId, member.amountCents])
    );

    return {
      groupId: group.id,
      groupName: group.name,
      currency: group.currency,
      periodStart:
        stats.periodStart === null ? null : new Date(stats.periodStart).toISOString(),
      periodEnd:
        stats.periodEnd === null ? null : new Date(stats.periodEnd).toISOString(),
      totalCents: stats.totalCents ?? 0,
      expenseCount: stats.expenseCount,
      balances: balances.map((member) => ({
        memberId: member.memberId,
        userId: member.userId,
        displayName: member.displayName,
        amountCents: member.amountCents,
      })),
      transfers: optimalSettle(balanceMap).map((transfer) => ({
        fromMemberId: transfer.from,
        fromName: names.get(transfer.from) ?? "未知成员",
        toMemberId: transfer.to,
        toName: names.get(transfer.to) ?? "未知成员",
        amountCents: transfer.amountCents,
      })),
    };
  } finally {
    database.close();
  }
}
