import { notFound } from "next/navigation";

import { ExpenseDetailView } from "@/components/expense-detail-view";
import { getExpenseDetail } from "@/server/expenses";

export default async function ExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const expense = getExpenseDetail(id);
  if (!expense) notFound();

  return <ExpenseDetailView expense={expense} />;
}
