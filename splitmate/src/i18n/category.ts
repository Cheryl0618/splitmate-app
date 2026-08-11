import { expenseCategories, type ExpenseCategory } from "@/lib/expense-input";

const keys = [
  "category.dining",
  "category.coffee",
  "category.transport",
  "category.lodging",
  "category.groceries",
  "category.household",
  "category.entertainment",
  "category.other",
] as const;

export function categoryKey(category: string) {
  const index = expenseCategories.indexOf(category as ExpenseCategory);
  return keys[index >= 0 ? index : keys.length - 1];
}
