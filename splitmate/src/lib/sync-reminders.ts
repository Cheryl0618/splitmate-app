export const BILL_REMINDER_THRESHOLD = 10;
export const BILL_REMINDER_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
export const EXPORT_SYNC_PROMPT_VERSION = "2026-v1";

export function shouldShowBillReminder({
  email,
  expenseCount,
  dismissedAt,
  now = Date.now(),
}: {
  email: string | null;
  expenseCount: number;
  dismissedAt: number | null;
  now?: number;
}) {
  if (email || expenseCount < BILL_REMINDER_THRESHOLD) return false;
  return dismissedAt === null || now - dismissedAt >= BILL_REMINDER_COOLDOWN_MS;
}
