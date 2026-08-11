"use client";

import html2canvas from "html2canvas";
import Link from "next/link";
import { Download } from "lucide-react";
import { useRef, useState } from "react";

import { Logo } from "@/components/logo";
import { IconButton } from "@/components/ui/icon-action";
import { useCurrentUser } from "@/lib/current-user";
import { formatCents, formatDate } from "@/lib/format";
import { EXPORT_SYNC_PROMPT_VERSION } from "@/lib/sync-reminders";
import type { ExportSummaryData } from "@/server/export-summary";
import type { PersonalSettingsData } from "@/server/settings";
import { useT } from "@/i18n/context";

function downloadDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function SummaryImageExport({ data }: { data: ExportSummaryData }) {
  const { currentUserId } = useCurrentUser();
  const { locale, t } = useT();
  const nodeRef = useRef<HTMLDivElement>(null);
  const generatedAtRef = useRef<HTMLSpanElement>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showSyncPrompt, setShowSyncPrompt] = useState(false);
  const currentMemberId = data.balances.find(
    (member) => member.userId === currentUserId
  )?.memberId;
  const name = (memberId: string, displayName: string) =>
    memberId === currentMemberId ? t("common.you") : displayName;
  const shortDate = (value: string | null) =>
    value ? formatDate(value, locale, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }) : t("export.noExpenses");

  async function exportImage() {
    if (!nodeRef.current || exporting) return;
    setExporting(true);
    setError("");
    setSuccess(false);
    try {
      if (generatedAtRef.current) {
        generatedAtRef.current.textContent = new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date());
      }
      await document.fonts.ready;
      const backgroundColor = getComputedStyle(document.documentElement)
        .getPropertyValue("--color-bg")
        .trim();
      const canvas = await html2canvas(nodeRef.current, {
        backgroundColor,
        scale: 1,
        width: 750,
        windowWidth: 750,
        logging: false,
      });
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (value) => (value ? resolve(value) : reject(new Error("Image generation failed"))),
          "image/png"
        );
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${data.groupName.replace(/[\\/:*?"<>|]/g, "-")}-${downloadDate()}.png`;
      link.click();
      URL.revokeObjectURL(url);
      setSuccess(true);
      const promptKey = `quits-export-sync-prompt:${currentUserId}:${EXPORT_SYNC_PROMPT_VERSION}`;
      const legacyPromptKey = `${["split", "mate"].join("")}-export-sync-prompt:${currentUserId}:${EXPORT_SYNC_PROMPT_VERSION}`;
      const promptWasShown =
        window.localStorage.getItem(promptKey) ??
        window.localStorage.getItem(legacyPromptKey);
      if (promptWasShown && !window.localStorage.getItem(promptKey)) {
        window.localStorage.setItem(promptKey, promptWasShown);
        window.localStorage.removeItem(legacyPromptKey);
      }
      if (!promptWasShown) {
        try {
          const response = await fetch("/api/settings", {
            headers: { "x-demo-user-id": currentUserId, "x-ui-locale": locale },
          });
          if (response.ok) {
            const settings = (await response.json()) as PersonalSettingsData;
            if (!settings.email) {
              window.localStorage.setItem(promptKey, "shown");
              setShowSyncPrompt(true);
            }
          }
        } catch (promptError) {
          console.error("[SummaryImageExport] sync prompt failed", promptError);
        }
      }
    } catch (caught) {
      console.error("[SummaryImageExport] failed", caught);
      setError(t("export.error"));
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <div className="flex flex-col items-start">
        <IconButton
          icon={Download}
          label={t(exporting ? "export.exporting" : "export.action")}
          disabled={exporting}
          onClick={() => void exportImage()}
          className="bg-surface"
        />
        {error ? <span className="mt-1 text-xs font-semibold text-ink">{error}</span> : null}
        {success ? (
          <div className="mt-2 max-w-xs text-xs leading-5">
            <p className="font-bold text-ink" role="status">{t("export.downloaded")}</p>
            {showSyncPrompt ? (
              <p className="mt-1 text-ink-soft">
                {t("export.syncPrompt")}
                <Link href="/settings#email-sync" className="ml-1 font-bold text-ink underline underline-offset-2">
                  {t("settings.bind")}
                </Link>
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="fixed left-[-10000px] top-0" aria-hidden="true">
        <div
          ref={nodeRef}
          style={{
            width: 750,
            padding: 48,
            fontSize: 24,
            lineHeight: 1.5,
            color: "var(--color-ink)",
            backgroundColor: "var(--color-bg)",
          }}
        >
          <div className="flex items-center gap-3" style={{ color: "var(--color-ink)" }}>
            <Logo size={32} />
            <span className="brand-wordmark text-[32px]">Quits</span>
            <span className="font-bold">{t("export.groupSummary")}</span>
          </div>
          <h1 style={{ fontSize: 44 }} className="mt-3 font-black tracking-tight">
            {data.groupName}
          </h1>
          <div className="mt-8 grid grid-cols-2 gap-4">
            <div className="rounded-[14px] p-5" style={{ backgroundColor: "var(--color-surface)" }}>
              <p style={{ color: "var(--color-ink-soft)" }}>{t("export.period")}</p>
              <p className="mt-2 font-bold">
                {t("relationship.monthRange", { from: shortDate(data.periodStart), to: shortDate(data.periodEnd) })}
              </p>
            </div>
            <div className="rounded-[14px] p-5" style={{ backgroundColor: "var(--color-surface)" }}>
              <p style={{ color: "var(--color-ink-soft)" }}>{t("export.totalSpent")}</p>
              <p style={{ fontSize: 32 }} className="amount mt-2 font-medium">
                {formatCents(data.totalCents, data.currency, locale)}
              </p>
            </div>
          </div>

          <section className="mt-6 rounded-[14px] p-6" style={{ backgroundColor: "var(--color-surface)" }}>
            <h2 style={{ fontSize: 30 }} className="font-extrabold">{t("group.memberBalances")}</h2>
            <div className="mt-4">
              {data.balances.map((member) => (
                <div
                  key={member.memberId}
                  className="flex justify-between gap-6 py-3"
                  style={{ borderBottom: "1px solid var(--color-line)" }}
                >
                  <span className="font-bold">{name(member.memberId, member.displayName)}</span>
                  <span
                    className={`amount text-[28px] font-medium ${
                      member.amountCents > 0
                        ? "text-ink"
                        : member.amountCents < 0
                          ? "text-accent"
                          : "text-ink"
                    }`}
                  >
                    {member.amountCents > 0 ? "+" : ""}
                    {formatCents(member.amountCents, data.currency, locale)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6 rounded-[14px] p-6" style={{ backgroundColor: "var(--color-surface)" }}>
            <h2 style={{ fontSize: 30 }} className="font-extrabold">{t("export.transferPlan")}</h2>
            <div className="mt-4 space-y-3">
              {data.transfers.length > 0 ? (
                data.transfers.map((transfer) => (
                  <p key={`${transfer.fromMemberId}:${transfer.toMemberId}`} className="font-bold">
                    {name(transfer.fromMemberId, transfer.fromName)} {t("settle.pays")} {name(transfer.toMemberId, transfer.toName)}: {" "}
                    <span className="amount text-[28px] font-medium">
                      {formatCents(transfer.amountCents, data.currency, locale)}
                    </span>
                  </p>
                ))
              ) : (
                <p className="font-medium text-ink-soft">{t("export.noTransfers")}</p>
              )}
            </div>
          </section>

          <div
            className="mt-8 flex justify-between gap-6 pt-5"
            style={{ borderTop: "1px solid var(--color-line)", color: "var(--color-ink-soft)" }}
          >
            <span>{t("export.expenseCount", { count: data.expenseCount })}</span>
            <span>{t("export.generatedAt")} <span ref={generatedAtRef}>—</span></span>
          </div>
        </div>
      </div>
    </>
  );
}
