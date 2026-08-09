import { notFound } from "next/navigation";

import { ExpenseForm, type ExpenseFormInitialValue } from "@/components/expense-form";
import { getExpenseDetail, getExpenseFormGroup } from "@/server/expenses";

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const expense = getExpenseDetail(id);
  if (!expense) notFound();
  const group = getExpenseFormGroup(expense.groupId);
  if (!group) notFound();

  const initialValue: ExpenseFormInitialValue = {
    id: expense.id,
    amountCents: expense.amountCents,
    description: expense.description,
    date: expense.date.slice(0, 10),
    paidBy: expense.paidByMemberId,
    method: expense.splitMethod,
    shares: expense.shares,
  };

  return <ExpenseForm group={group} initialValue={initialValue} />;
}
