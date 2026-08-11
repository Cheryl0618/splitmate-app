"use client";

import { useT } from "@/i18n/context";

export default function Loading() {
  const { t } = useT();
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-bg px-4 py-8 text-ink sm:px-8">
      <div className="mx-auto max-w-5xl animate-pulse" role="status" aria-live="polite">
        <span className="sr-only">{t("loading.page")}</span>
        <div className="h-4 w-24 rounded-full bg-inset" />
        <div className="mt-6 h-10 w-48 max-w-full rounded-[14px] bg-inset" />
        <div className="mt-8 space-y-4 rounded-[14px] bg-surface p-5 sm:p-8">
          <div className="h-5 w-2/3 rounded-full bg-inset" />
          <div className="h-20 rounded-[14px] bg-inset" />
          <div className="h-20 rounded-[14px] bg-inset" />
        </div>
      </div>
    </main>
  );
}
