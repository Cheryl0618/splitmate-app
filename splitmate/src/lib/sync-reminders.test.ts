import { describe, expect, it } from "vitest";

import {
  BILL_REMINDER_COOLDOWN_MS,
  shouldShowBillReminder,
} from "./sync-reminders";

describe("sync reminders", () => {
  it("does not show the bill reminder before ten bills", () => {
    expect(
      shouldShowBillReminder({
        email: null,
        expenseCount: 9,
        dismissedAt: null,
        now: 1_000,
      })
    ).toBe(false);
  });

  it("stays hidden for seven days after dismissal", () => {
    const dismissedAt = 10_000;
    expect(
      shouldShowBillReminder({
        email: null,
        expenseCount: 10,
        dismissedAt,
        now: dismissedAt + BILL_REMINDER_COOLDOWN_MS - 1,
      })
    ).toBe(false);
    expect(
      shouldShowBillReminder({
        email: null,
        expenseCount: 10,
        dismissedAt,
        now: dismissedAt + BILL_REMINDER_COOLDOWN_MS,
      })
    ).toBe(true);
  });

  it("does not show once email sync is enabled", () => {
    expect(
      shouldShowBillReminder({
        email: "bound@example.com",
        expenseCount: 100,
        dismissedAt: null,
      })
    ).toBe(false);
  });
});
