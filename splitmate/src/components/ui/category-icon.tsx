import {
  BedDouble,
  Car,
  CircleDashed,
  Coffee,
  Package,
  ShoppingCart,
  Ticket,
  UtensilsCrossed,
} from "lucide-react";

import { expenseCategories, type ExpenseCategory } from "@/lib/expense-input";

const categoryIcons = {
  [expenseCategories[0]]: UtensilsCrossed,
  [expenseCategories[1]]: Coffee,
  [expenseCategories[2]]: Car,
  [expenseCategories[3]]: BedDouble,
  [expenseCategories[4]]: ShoppingCart,
  [expenseCategories[5]]: Package,
  [expenseCategories[6]]: Ticket,
  [expenseCategories[7]]: CircleDashed,
} satisfies Record<ExpenseCategory, typeof CircleDashed>;

export function CategoryIcon({ category }: { category: string }) {
  const Icon = categoryIcons[category as ExpenseCategory] ?? CircleDashed;
  return <Icon aria-hidden="true" size={16} strokeWidth={2} />;
}
