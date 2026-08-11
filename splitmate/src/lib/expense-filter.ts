import type { Currency } from "./currency";
import type { ExpenseCategory } from "./expense-input";
import { formatCents } from "./format";
import type { Locale } from "@/i18n/context";

export interface FilterableExpense {
  description: string;
  amountCents: number;
  category: ExpenseCategory;
}

export function filterExpenses<T extends FilterableExpense>(
  expenses: T[],
  query: string,
  categories: ExpenseCategory[],
  currency: Currency,
  locale: Locale = "en"
) {
  const normalizedQuery = query.trim().toLocaleLowerCase(locale === "zh" ? "zh-CN" : "en-US");
  const selectedCategories = new Set(categories);

  return expenses.filter((expense) => {
    const matchesCategory =
      selectedCategories.size === 0 || selectedCategories.has(expense.category);
    if (!matchesCategory) return false;
    if (!normalizedQuery) return true;

    return (
      expense.description.toLocaleLowerCase(locale === "zh" ? "zh-CN" : "en-US").includes(normalizedQuery) ||
      (expense.amountCents / 100).toFixed(2).includes(normalizedQuery) ||
      formatCents(expense.amountCents, currency, locale)
        .toLocaleLowerCase(locale === "zh" ? "zh-CN" : "en-US")
        .includes(normalizedQuery)
    );
  });
}

export function totalExpenseCents(expenses: FilterableExpense[]) {
  return expenses.reduce((total, expense) => total + expense.amountCents, 0);
}
