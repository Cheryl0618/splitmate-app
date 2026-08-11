"use client";

import { ChevronLeft } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { ConsumptionSummaryPanel } from "@/components/consumption-summary-panel";
import { Chip } from "@/components/ui/chip";
import { CategoryIcon } from "@/components/ui/category-icon";
import { IconLink } from "@/components/ui/icon-action";
import { formatCents } from "@/lib/format";
import type { RelationshipPageData } from "@/server/relationships";
import { useT } from "@/i18n/context";
import { categoryKey } from "@/i18n/category";

function relationshipDuration(firstExpenseAt: string, locale: "zh" | "en", t: (key: string, values?: Record<string, string | number>) => string) {
  const first = new Date(firstExpenseAt);
  const now = new Date();
  const months = Math.max(1, (now.getUTCFullYear() - first.getUTCFullYear()) * 12 + now.getUTCMonth() - first.getUTCMonth());
  if (months < 12) return t("relationship.months", { count: months });
  const years = Math.floor(months / 12);
  const remainder = months % 12;
  return remainder > 0
    ? t("relationship.yearsMonths", { years, months: remainder })
    : t("relationship.years", { count: years });
}

function formatMonth(month: string, locale: "zh" | "en") {
  if (!month) return "—";
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", { year: "numeric", month: locale === "zh" ? "long" : "short", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00.000Z`));
}

export function RelationshipView({ data }: { data: RelationshipPageData }) {
  const { locale, t } = useT();
  if (data.state === "not-member") {
    return (
      <main className="min-h-screen bg-bg px-4 py-12 text-ink">
        <div className="mx-auto max-w-3xl">
          <EmptyState
            title={t("relationship.notMember")}
            description={t("relationship.notMemberDescription")}
            actionHref={`/groups/${data.groupId}`}
            actionLabel={t("relationship.backGroup")}
          />
        </div>
      </main>
    );
  }

  if (data.state === "same-member") {
    return (
      <main className="min-h-screen bg-bg px-4 py-12 text-ink">
        <div className="mx-auto max-w-3xl">
          <EmptyState
            title={t("relationship.sameMember")}
            description={t("relationship.sameMemberDescription")}
            actionHref={`/groups/${data.groupId}`}
            actionLabel={t("relationship.chooseOther")}
          />
        </div>
      </main>
    );
  }

  if (data.state === "no-shared") {
    return (
      <main className="min-h-screen bg-bg px-4 py-12 text-ink">
        <div className="mx-auto max-w-3xl">
          <EmptyState
            title={t("relationship.noShared")}
            description={t("relationship.noSharedDescription")}
            actionHref={`/groups/${data.groupId}/expenses/new`}
            actionLabel={t("relationship.addShared")}
            showPlusIcon
          />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bg text-ink">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 lg:px-12">
        <header>
          <IconLink
            href={`/groups/${data.groupId}`}
            icon={ChevronLeft}
            label={t("settle.backGroup", { name: data.groupName })}
            className="bg-surface"
          />
        </header>

        <div className="pb-8 pt-10 sm:pt-14">
          <p className="text-sm font-semibold text-ink">{t("nav.relationship")}</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
            {t("relationship.youAnd", { name: data.targetMemberName })}
          </h1>
          <p className="mt-3 text-sm text-ink-soft">
            {t("relationship.description")}
          </p>
        </div>

        <div className="space-y-6 pb-16">
          <ConsumptionSummaryPanel
            endpoint={`/api/groups/${data.groupId}/members/${data.targetMemberId}/insights`}
            currency={data.currency}
          />

          <section className="grid gap-4 sm:grid-cols-3" aria-label={t("relationship.overview")}>
            {[
              [t("relationship.duration"), relationshipDuration(data.overview.firstSharedExpenseAt, locale, t)],
              [t("relationship.spentTogether"), formatCents(data.overview.totalSharedCents, data.currency, locale)],
              [t("relationship.timesTogether"), t("relationship.times", { count: data.overview.sharedExpenseCount })],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-[14px] bg-surface p-5"
              >
                <p className="text-sm font-semibold text-ink-soft">{label}</p>
                <p className="amount mt-3 text-2xl font-medium tracking-tight">{value}</p>
              </div>
            ))}
          </section>

          <section className="rounded-[14px] bg-surface p-5 sm:p-7">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">{t("relationship.recentBurden")}</h2>
                <p className="mt-1 text-sm text-ink-soft">
                  {t("relationship.burdenDescription")}
                </p>
              </div>
              <p className="text-sm font-semibold text-ink-soft">
                {t("relationship.monthRange", { from: formatMonth(data.recentBurden.fromMonth, locale), to: formatMonth(data.recentBurden.toMonth, locale) })}
              </p>
            </div>
            <div className="mt-6 flex h-4 w-full overflow-hidden rounded-full bg-inset">
              <span
                className="h-full bg-accent"
                style={{ width: data.recentBurden.aWidth }}
                aria-label={t("relationship.shareRatio", { name: t("common.you"), ratio: data.recentBurden.aRatioLabel })}
              />
              <span
                className="h-full bg-accent-light"
                style={{ width: data.recentBurden.bWidth }}
                aria-label={t("relationship.shareRatio", { name: data.targetMemberName, ratio: data.recentBurden.bRatioLabel })}
              />
            </div>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-[14px] bg-inset px-4 py-3 text-ink">
                <p className="font-bold">
                  {t("relationship.shareRatio", { name: t("common.you"), ratio: data.recentBurden.aRatioLabel })}
                </p>
                <p className="amount mt-1 text-lg text-ink">
                  {formatCents(data.recentBurden.aCents, data.currency, locale)}
                </p>
              </div>
              <div className="rounded-[14px] bg-inset px-4 py-3 text-ink">
                <p className="font-bold">
                  {t("relationship.shareRatio", { name: data.targetMemberName, ratio: data.recentBurden.bRatioLabel })}
                </p>
                <p className="amount mt-1 text-lg text-ink">
                  {formatCents(data.recentBurden.bCents, data.currency, locale)}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[14px] bg-surface p-5 sm:p-7">
            <h2 className="text-xl font-bold">{t("relationship.spendingProfile")}</h2>
            <p className="mt-1 text-sm text-ink-soft">{t("relationship.topCategories")}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {data.topCategories.map((category, index) => (
                <div key={category.category} className="rounded-[14px] bg-inset p-4">
                  <p className="text-xs font-bold text-ink">TOP {index + 1}</p>
                  <div className="mt-2">
                    <Chip as="span">
                      <CategoryIcon category={category.category} />
                      {t(categoryKey(category.category))}
                    </Chip>
                  </div>
                  <p className="amount mt-3 text-lg font-medium">{formatCents(category.cents, data.currency, locale)}</p>
                  <p className="mt-1 text-sm text-ink-soft">{t("expense.count", { count: category.count })}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[14px] bg-surface p-5 sm:p-7">
            <h2 className="text-xl font-bold">{t("relationship.settlementHabits")}</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div className="rounded-[14px] bg-inset p-4">
                <p className="text-sm font-semibold text-ink-soft">{t("relationship.avgSettle")}</p>
                <p className="mt-2 text-2xl font-extrabold">
                  {data.settlementHabits.settledExpenseCount > 0
                    ? t("relationship.days", { count: data.settlementHabits.avgSettleDays.toFixed(1) })
                    : t("relationship.noRecord")}
                </p>
                <p className="mt-2 text-xs text-ink-soft">
                  {t("relationship.basedOn", { count: data.settlementHabits.settledExpenseCount })}
                </p>
              </div>
              <div className="rounded-[14px] bg-inset p-4 text-ink">
                <p className="text-sm font-semibold">
                  {t("relationship.paidCount", { name: t("common.you"), count: data.settlementHabits.aPaidCount })}
                </p>
                <p className="amount mt-2 text-xl font-medium">
                  {t("relationship.paidAmount", { amount: formatCents(data.settlementHabits.aPaidCents, data.currency, locale) })}
                </p>
              </div>
              <div className="rounded-[14px] bg-inset p-4 text-ink">
                <p className="text-sm font-semibold">
                  {t("relationship.paidCount", { name: data.targetMemberName, count: data.settlementHabits.bPaidCount })}
                </p>
                <p className="amount mt-2 text-xl font-medium">
                  {t("relationship.paidAmount", { amount: formatCents(data.settlementHabits.bPaidCents, data.currency, locale) })}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
