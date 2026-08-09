import { notFound } from "next/navigation";

import { ExpenseForm } from "@/components/expense-form";
import { getExpenseFormGroup } from "@/server/expenses";

export default async function NewExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const group = getExpenseFormGroup(id);
  if (!group) notFound();

  return <ExpenseForm group={group} />;
}
