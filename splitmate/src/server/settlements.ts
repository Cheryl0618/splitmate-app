import { computeDirectDebts } from "@/lib/direct-debts";
import {
  computeNetBalances,
  optimalSettle,
  type Expense,
  type Transfer,
} from "@/lib/settlement";
import { openDatabase } from "@/server/database";
import type { Currency } from "@/lib/currency";
import { getExportSummaryData, type ExportSummaryData } from "@/server/export-summary";

export interface SettlementMember {
  id: string;
  userId: string | null;
  displayName: string;
}

export interface ExplanationItem {
  expenseId: string;
  description: string;
  counterpartyId: string;
  counterpartyName: string;
  amountCents: number;
}

export interface SettlementTransferData extends Transfer {
  fromName: string;
  toName: string;
  explanation: {
    debtorItems: ExplanationItem[];
    creditorItems: ExplanationItem[];
    hasDirectDebt: boolean;
  };
}

export interface SettlementPageData {
  id: string;
  name: string;
  currency: Currency;
  members: SettlementMember[];
  balances: Record<string, number>;
  directTransfers: SettlementTransferData[];
  optimalTransfers: SettlementTransferData[];
  isSettled: boolean;
  confirmedSettlements: Array<{
    id: string;
    fromMemberId: string;
    toMemberId: string;
    fromName: string;
    toName: string;
    amountCents: number;
    confirmedAt: string;
  }>;
  exportSummary: ExportSummaryData;
}

interface GroupRow {
  id: string;
  name: string;
  currency: Currency;
}

interface ExpenseRow {
  id: string;
  description: string;
  amountCents: number;
  paidBy: string;
}

interface ShareRow {
  expenseId: string;
  memberId: string;
  amountCents: number;
}

interface SettlementRow {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  amountCents: number;
  confirmedAt: number | string;
}

export function getSettlementPageData(groupId: string): SettlementPageData | null {
  const database = openDatabase();

  try {
    const group = database
      .prepare(`SELECT id, name, currency FROM "Group" WHERE id = ?`)
      .get(groupId) as GroupRow | undefined;
    if (!group) return null;

    const memberRows = database
      .prepare(
        `SELECT id, userId, displayName
         FROM "GroupMember"
         WHERE groupId = ?
         ORDER BY createdAt, id`
      )
      .all(groupId) as SettlementMember[];
    const expenseRows = database
      .prepare(
        `SELECT id, description, amountCents, paidBy
         FROM "Expense"
         WHERE groupId = ? AND settled = 0
         ORDER BY date, createdAt, id`
      )
      .all(groupId) as ExpenseRow[];
    const shareRows = database
      .prepare(
        `SELECT share.expenseId, share.memberId, share.amountCents
         FROM "ExpenseShare" AS share
         INNER JOIN "Expense" AS expense ON expense.id = share.expenseId
         WHERE expense.groupId = ? AND expense.settled = 0`
      )
      .all(groupId) as ShareRow[];
    const settlementRows = database
      .prepare(
        `SELECT id, fromMemberId, toMemberId, amountCents, confirmedAt
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

    const sourceExpenses = expenseRows.map((expense) => ({
      ...expense,
      shares: sharesByExpense.get(expense.id) ?? {},
    }));
    const calculationExpenses: Expense[] = sourceExpenses.map((expense) => ({
      id: expense.id,
      amountCents: expense.amountCents,
      paidBy: expense.paidBy,
      shares: expense.shares,
    }));
    for (const settlement of settlementRows) {
      calculationExpenses.push({
        id: `settlement:${settlement.id}`,
        amountCents: settlement.amountCents,
        paidBy: settlement.fromMemberId,
        shares: { [settlement.toMemberId]: settlement.amountCents },
      });
    }

    const members = memberRows.map(({ id, userId, displayName }) => ({
      id,
      userId,
      displayName,
    }));
    const memberNames = new Map(
      members.map((member) => [member.id, member.displayName])
    );
    const balances = computeNetBalances(calculationExpenses);
    const directTransfers = computeDirectDebts(calculationExpenses);
    const optimalTransfers = optimalSettle(balances);

    const withExplanation = (transfer: Transfer): SettlementTransferData => {
      const debtorItems = sourceExpenses.flatMap((expense) => {
        const amountCents = expense.shares[transfer.from] ?? 0;
        if (expense.paidBy === transfer.from || amountCents <= 0) return [];
        return [
          {
            expenseId: expense.id,
            description: expense.description,
            counterpartyId: expense.paidBy,
            counterpartyName: memberNames.get(expense.paidBy) ?? "未知成员",
            amountCents,
          },
        ];
      });
      const creditorItems = sourceExpenses.flatMap((expense) => {
        if (expense.paidBy !== transfer.to) return [];
        const amountCents =
          expense.amountCents - (expense.shares[transfer.to] ?? 0);
        if (amountCents <= 0) return [];
        return [
          {
            expenseId: expense.id,
            description: expense.description,
            counterpartyId: "",
            counterpartyName: "群组成员",
            amountCents,
          },
        ];
      });

      return {
        ...transfer,
        fromName: memberNames.get(transfer.from) ?? "未知成员",
        toName: memberNames.get(transfer.to) ?? "未知成员",
        explanation: {
          debtorItems,
          creditorItems,
          hasDirectDebt: directTransfers.some(
            (direct) => direct.from === transfer.from && direct.to === transfer.to
          ),
        },
      };
    };

    const exportSummary = getExportSummaryData(groupId);
    if (!exportSummary) return null;

    return {
      id: group.id,
      name: group.name,
      currency: group.currency,
      members,
      balances: Object.fromEntries(
        members.map((member) => [member.id, balances.get(member.id) ?? 0])
      ),
      directTransfers: directTransfers.map(withExplanation),
      optimalTransfers: optimalTransfers.map(withExplanation),
      isSettled: members.every((member) => (balances.get(member.id) ?? 0) === 0),
      confirmedSettlements: settlementRows
        .map((settlement) => ({
          id: settlement.id,
          fromMemberId: settlement.fromMemberId,
          toMemberId: settlement.toMemberId,
          fromName: memberNames.get(settlement.fromMemberId) ?? "未知成员",
          toName: memberNames.get(settlement.toMemberId) ?? "未知成员",
          amountCents: settlement.amountCents,
          confirmedAt: new Date(settlement.confirmedAt).toISOString(),
        }))
        .reverse(),
      exportSummary,
    };
  } finally {
    database.close();
  }
}
