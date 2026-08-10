import type { Currency } from "./currency";
import type { ExpenseCategory } from "./expense-input";
import { formatCents } from "./format";

export interface FilterableExpense {
  description: string;
  amountCents: number;
  category: ExpenseCategory;
}

export function filterExpenses<T extends FilterableExpense>(
  expenses: T[],
  query: string,
  categories: ExpenseCategory[],
  currency: Currency
) {
  const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
  const selectedCategories = new Set(categories);

  return expenses.filter((expense) => {
    const matchesCategory =
      selectedCategories.size === 0 || selectedCategories.has(expense.category);
    if (!matchesCategory) return false;
    if (!normalizedQuery) return true;

    return (
      expense.description.toLocaleLowerCase("zh-CN").includes(normalizedQuery) ||
      (expense.amountCents / 100).toFixed(2).includes(normalizedQuery) ||
      formatCents(expense.amountCents, currency)
        .toLocaleLowerCase("zh-CN")
        .includes(normalizedQuery)
    );
  });
}

export function totalExpenseCents(expenses: FilterableExpense[]) {
  return expenses.reduce((total, expense) => total + expense.amountCents, 0);
}
