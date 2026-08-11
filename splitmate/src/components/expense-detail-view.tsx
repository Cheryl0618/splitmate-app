"use client";

/* eslint-disable @next/next/no-img-element */
import { ChevronLeft } from "lucide-react";

import { ExpenseActions } from "@/components/expense-actions";
import { PerspectiveAvatar, PerspectiveName } from "@/components/perspective-name";
import { Chip } from "@/components/ui/chip";
import { CategoryIcon } from "@/components/ui/category-icon";
import { IconLink } from "@/components/ui/icon-action";
import { useT } from "@/i18n/context";
import { formatCents, formatDate } from "@/lib/format";
import type { ExpenseDetailData } from "@/server/expenses";
import { categoryKey } from "@/i18n/category";

export function ExpenseDetailView({ expense }: { expense: ExpenseDetailData }) {
  const { locale, t } = useT();
  const shareTotalCents = expense.shares.reduce((total, share) => total + share.amountCents, 0);
  const sharesMatch = shareTotalCents === expense.amountCents;

  return (
    <main className="min-h-screen bg-bg text-ink">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 lg:px-12">
        <IconLink href={`/groups/${expense.groupId}`} icon={ChevronLeft} label={t("settle.backGroup", { name: expense.groupName })} className="bg-surface" />
        <article className="mt-6 overflow-hidden rounded-[14px] bg-surface">
          <header className="border-b border-line px-5 py-7 sm:px-8">
            <div className="flex items-start justify-between gap-4">
              <p className="pt-2 text-sm font-semibold text-ink">{t("nav.expenseDetail")}</p>
              <ExpenseActions expenseId={expense.id} groupId={expense.groupId} createdById={expense.createdById} />
            </div>
            <h1 className={`mt-2 text-3xl font-extrabold tracking-tight ${expense.settled ? "text-ink-soft line-through" : ""}`}>{expense.description}</h1>
            <div className="mt-4"><Chip as="span"><CategoryIcon category={expense.category} />{t(categoryKey(expense.category))}</Chip></div>
            <p className="amount mt-5 text-4xl font-medium tracking-tight">{formatCents(expense.amountCents, expense.currency, locale)}</p>
            <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-ink-soft">{t("expense.date")}</dt><dd className="mt-1 font-semibold">{formatDate(expense.date, locale, { year: "numeric", month: locale === "zh" ? "long" : "short", day: "numeric", timeZone: "UTC" })}</dd></div>
              <div><dt className="text-ink-soft">{t("expense.payer")}</dt><dd className="mt-1 font-semibold"><PerspectiveName userId={expense.paidByUserId} displayName={expense.paidByName} /></dd></div>
            </dl>
          </header>
          <section className="px-5 py-7 sm:px-8" aria-labelledby="shares-heading">
            <h2 id="shares-heading" className="text-lg font-bold">{t("expense.shareDetails")}</h2>
            <div className="mt-4 divide-y divide-line">
              {expense.shares.map((share) => (
                <div key={share.memberId} className="flex min-w-0 items-center justify-between gap-3 py-4">
                  <div className="flex min-w-0 items-center gap-3"><PerspectiveAvatar userId={share.userId} displayName={share.displayName} /><span className="truncate font-semibold"><PerspectiveName userId={share.userId} displayName={share.displayName} /></span></div>
                  <span className="amount shrink-0 text-lg font-medium">{formatCents(share.amountCents, expense.currency, locale)}</span>
                </div>
              ))}
            </div>
            <div className="amount mt-5 rounded-[14px] bg-inset px-4 py-3 text-sm font-medium text-ink" role={sharesMatch ? undefined : "alert"}>
              {t("expense.shareCheck", { shares: formatCents(shareTotalCents, expense.currency, locale), total: formatCents(expense.amountCents, expense.currency, locale) })}
            </div>
          </section>
          {expense.photoUrls.length > 0 ? (
            <section className="border-t border-line px-5 py-7 sm:px-8">
              <h2 className="text-lg font-bold">{t("expense.receiptOriginal")}</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {expense.photoUrls.map((photoUrl, index) => <img key={`${photoUrl}:${index}`} src={photoUrl} alt={t("expense.receiptIndex", { index: index + 1 })} className="w-full rounded-[14px] border border-line object-contain" />)}
              </div>
            </section>
          ) : null}
        </article>
      </div>
    </main>
  );
}
