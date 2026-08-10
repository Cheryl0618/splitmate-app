import type { SplitMethod, SplitParticipant } from "./split";

export const expenseCategories = [
  "餐饮",
  "咖啡",
  "交通",
  "住宿",
  "超市",
  "日用",
  "娱乐",
  "其他",
] as const;

export type ExpenseCategory = (typeof expenseCategories)[number];

export interface ExpenseInput {
  amountCents: number;
  description: string;
  date: string;
  paidBy: string;
  category: ExpenseCategory;
  method: SplitMethod;
  participants: SplitParticipant[];
  photoUrls?: string[];
}
