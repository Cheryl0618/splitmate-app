"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

import { IconButton } from "@/components/ui/icon-action";
import { useCurrentUser } from "@/lib/current-user";
import { shouldShowBillReminder } from "@/lib/sync-reminders";
import type { PersonalSettingsData } from "@/server/settings";
import { useT } from "@/i18n/context";

function dismissalKey(userId: string) {
  return `quits-sync-reminder-dismissed:${userId}`;
}

function legacyDismissalKey(userId: string) {
  return `${["split", "mate"].join("")}-sync-reminder-dismissed:${userId}`;
}

export function SyncReminderBanner() {
  const { currentUserId } = useCurrentUser();
  const { locale, t } = useT();
  const [expenseCount, setExpenseCount] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/settings", {
      headers: { "x-demo-user-id": currentUserId, "x-ui-locale": locale },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as PersonalSettingsData;
      })
      .then((data) => {
        if (!data || controller.signal.aborted) return;
        const currentKey = dismissalKey(currentUserId);
        const legacyKey = legacyDismissalKey(currentUserId);
        const currentDismissedAt = window.localStorage.getItem(currentKey);
        const legacyDismissedAt = window.localStorage.getItem(legacyKey);
        const rawDismissedAt = currentDismissedAt ?? legacyDismissedAt;
        if (!currentDismissedAt && legacyDismissedAt) {
          window.localStorage.setItem(currentKey, legacyDismissedAt);
          window.localStorage.removeItem(legacyKey);
        }
        const dismissedAt = rawDismissedAt === null ? null : Number(rawDismissedAt);
        setExpenseCount(data.expenseCount);
        setVisible(
          shouldShowBillReminder({
            email: data.email,
            expenseCount: data.expenseCount,
            dismissedAt: Number.isFinite(dismissedAt) ? dismissedAt : null,
          })
        );
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          console.error("[SyncReminderBanner] failed", error);
        }
      });
    return () => controller.abort();
  }, [currentUserId, locale]);

  if (!visible || expenseCount === null) return null;

  return (
    <aside className="mb-6 flex items-start justify-between gap-4 rounded-[14px] bg-inset px-4 py-4 text-ink sm:px-5">
      <p className="text-sm font-semibold leading-6">
        {t("sync.reminder", { count: expenseCount })}
        <Link href="/settings#email-sync" className="ml-1 font-extrabold text-ink underline underline-offset-2">
          {t("sync.bindPrompt")}
        </Link>
      </p>
      <IconButton
        icon={X}
        label={t("sync.closeReminder")}
        onClick={() => {
          window.localStorage.setItem(dismissalKey(currentUserId), String(Date.now()));
          setVisible(false);
        }}
        className="bg-surface"
      />
    </aside>
  );
}
