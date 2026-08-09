import type { SplitMethod, SplitParticipant } from "./split";

export interface ExpenseInput {
  amountCents: number;
  description: string;
  date: string;
  paidBy: string;
  method: SplitMethod;
  participants: SplitParticipant[];
  photoUrls?: string[];
}
