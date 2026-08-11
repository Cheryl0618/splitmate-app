"use client";

import Link from "next/link";
import { ChevronLeft, Plus, Settings, X } from "lucide-react";
import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { ConsumptionSummaryPanel } from "@/components/consumption-summary-panel";
import { SummaryImageExport } from "@/components/summary-image-export";
import { SyncReminderBanner } from "@/components/sync-reminder-banner";
import { Chip } from "@/components/ui/chip";
import { CategoryIcon } from "@/components/ui/category-icon";
import { IconLink } from "@/components/ui/icon-action";
import { useCurrentUser } from "@/lib/current-user";
import { avatarColorClass } from "@/lib/avatar-colors";
import { formatCents, formatDate } from "@/lib/format";
import { expenseCategories, type ExpenseCategory } from "@/lib/expense-input";
import { filterExpenses, totalExpenseCents } from "@/lib/expense-filter";
import type { Currency } from "@/lib/currency";
import type { GroupDetailData, GroupExpenseSummary } from "@/server/group-details";
import { useT } from "@/i18n/context";
import { categoryKey } from "@/i18n/category";

function groupExpensesByDate(expenses: GroupExpenseSummary[]) {
  const groups = new Map<string, GroupExpenseSummary[]>();
  for (const expense of expenses) {
    const date = expense.date.slice(0, 10);
    const entries = groups.get(date) ?? [];
    entries.push(expense);
    groups.set(date, entries);
  }
  return [...groups];
}

function BalanceAmount({
  amountCents,
  currency,
}: {
  amountCents: number;
  currency: Currency;
}) {
  const { locale, t } = useT();
  if (amountCents > 0) {
    return <span className="amount text-lg font-medium text-ink">+{formatCents(amountCents, currency, locale)}</span>;
  }
  if (amountCents < 0) {
    return <span className="amount text-lg font-medium text-accent">{formatCents(amountCents, currency, locale)}</span>;
  }
  return <span className="font-semibold text-ink-soft">{t("common.settled")}</span>;
}

export function GroupDetailView({ group }: { group: GroupDetailData }) {
  const { currentUserId } = useCurrentUser();
  const { locale, t } = useT();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const expenseQuery = searchParams.get("q") ?? "";
  const categoryParam = searchParams.get("cat") ?? "";
  const selectedCategories = useMemo(() => {
    const requested = new Set(categoryParam.split(","));
    return expenseCategories.filter((category) => requested.has(category));
  }, [categoryParam]);
  const currentMember = group.members.find((member) => member.userId === currentUserId);
  const orderedBalances = [...group.balances].sort((left, right) => {
    if (left.userId === currentUserId) return -1;
    if (right.userId === currentUserId) return 1;
    return 0;
  });
  const balanceTotalCents = group.balances.reduce(
    (total, balance) => total + balance.amountCents,
    0
  );
  const hasCurrentParticipation = Boolean(
    currentMember &&
      group.expenses.some((expense) =>
        expense.shares.some((share) => share.memberId === currentMember.id)
      )
  );
  const filteredExpenses = useMemo(() => {
    return filterExpenses(
      group.expenses,
      expenseQuery,
      selectedCategories,
      group.currency,
      locale
    );
  }, [expenseQuery, group.currency, group.expenses, locale, selectedCategories]);
  const filteredTotalCents = totalExpenseCents(filteredExpenses);

  function replaceFilters(query: string, categories: ExpenseCategory[]) {
    const next = new URLSearchParams(searchParams.toString());
    if (query.trim()) next.set("q", query);
    else next.delete("q");
    if (categories.length) next.set("cat", categories.join(","));
    else next.delete("cat");
    const suffix = next.toString();
    router.replace(suffix ? `${pathname}?${suffix}` : pathname, { scroll: false });
  }

  function toggleCategory(category: ExpenseCategory) {
    const selected = new Set(selectedCategories);
    if (selected.has(category)) selected.delete(category);
    else selected.add(category);
    replaceFilters(
      expenseQuery,
      expenseCategories.filter((option) => selected.has(option))
    );
  }

  function clearFilters() {
    replaceFilters("", []);
  }

  function clearCategories() {
    replaceFilters(expenseQuery, []);
  }

  return (
    <main className="min-h-screen bg-bg text-ink">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 lg:px-12">
        <header>
          <IconLink
            href="/"
            icon={ChevronLeft}
            label={t("group.backAll")}
            className="bg-surface"
          />
        </header>

        <div className="pb-8 pt-12 sm:pt-16">
          <p className="mb-2 text-sm font-semibold text-ink">{t("home.sharedLedger")}</p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{group.name}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <SummaryImageExport data={group.exportSummary} />
              <IconLink
                href={`/groups/${group.id}/settings#members`}
                icon={Settings}
                label={t("group.openSettings")}
                className="bg-surface"
              />
            </div>
          </div>
        </div>

        <SyncReminderBanner />

        <div className="mb-8">
          <ConsumptionSummaryPanel endpoint={`/api/groups/${group.id}/insights`} currency={group.currency} />
        </div>

        {balanceTotalCents !== 0 ? (
          <div
            role="alert"
            className="mb-6 rounded-[14px] bg-inset px-5 py-4 font-semibold text-ink"
          >
            {t("group.balanceError", {
              actual: formatCents(balanceTotalCents, group.currency, locale),
              expected: formatCents(0, group.currency, locale),
            })}
          </div>
        ) : null}

        <section aria-labelledby="balances-heading">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 id="balances-heading" className="text-xl font-bold">
                {t("group.memberBalances")}
              </h2>
              <p className="mt-1 text-sm text-ink-soft">{t("group.balanceHint")}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-ink-soft">{t("group.peopleCount", { count: group.members.length })}</span>
              <Link
                href={`/groups/${group.id}/settle`}
                className="rounded-full bg-surface px-4 py-2 text-sm font-bold text-ink hover:opacity-70"
              >
                {t("settle.action")}
              </Link>
            </div>
          </div>

          <div className="overflow-hidden rounded-[14px] bg-surface">
            {orderedBalances.map((balance) => {
              const isCurrent = balance.userId === currentUserId;
              const member = group.members.find(
                (candidate) => candidate.id === balance.memberId
              );
              return (
                <Link
                  key={balance.memberId}
                  href={`/groups/${group.id}/members/${balance.memberId}`}
                  className={`flex items-center justify-between border-b border-line px-5 py-4 transition-colors last:border-b-0 ${
                    isCurrent ? "bg-inset" : "hover:bg-inset"
                  }`}
                  aria-label={isCurrent ? t("group.viewMyProfile") : t("group.viewRelationship", { name: balance.displayName })}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`grid h-10 w-10 place-items-center rounded-full text-sm font-bold ${avatarColorClass(member?.avatarColor)}`}
                    >
                      {(isCurrent ? t("common.you") : balance.displayName).slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <p className="font-semibold">{isCurrent ? t("common.you") : balance.displayName}</p>
                      {isCurrent ? (
                        <p className="text-xs font-medium text-ink">{t("group.myBalance")}</p>
                      ) : null}
                    </div>
                  </div>
                  <BalanceAmount amountCents={balance.amountCents} currency={group.currency} />
                </Link>
              );
            })}
          </div>

        </section>

        <section className="pb-32 pt-12" aria-labelledby="expenses-heading">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 id="expenses-heading" className="text-xl font-bold">
                {t("expense.list")}
              </h2>
              <p className="mt-1 text-sm text-ink-soft">{t("expense.listDescription")}</p>
            </div>
            <Link
              href={`/groups/${group.id}/expenses/new`}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-surface hover:opacity-85"
            >
              <Plus aria-hidden="true" size={18} strokeWidth={2} />
              {t("expense.add")}
            </Link>
          </div>

          {group.expenses.length > 0 ? (
            <div className="mb-6 rounded-[14px] bg-surface p-4 sm:p-5">
              <label className="block text-sm font-bold text-ink" htmlFor="expense-search">
                {t("expense.search")}
              </label>
              <input
                id="expense-search"
                type="search"
                value={expenseQuery}
                onChange={(event) =>
                  replaceFilters(event.target.value, selectedCategories)
                }
                placeholder={t("expense.searchPlaceholder")}
                className="mt-2 w-full min-w-0 rounded-[14px] border border-line px-4 py-3 text-sm outline-none focus:border-line focus:ring-2 focus:ring-ink"
              />

              <fieldset className="mt-5">
                <legend className="text-sm font-bold text-ink">{t("expense.categoryFilter")}</legend>
                <div className="mt-3 flex flex-wrap gap-2">
                  {expenseCategories.map((category) => {
                    const selected = selectedCategories.includes(category);
                    return (
                      <Chip
                        key={category}
                        pressed={selected}
                        onClick={() => toggleCategory(category)}
                      >
                        <CategoryIcon category={category} />
                        {t(categoryKey(category))}
                      </Chip>
                    );
                  })}
                  {selectedCategories.length > 0 ? (
                    <Chip
                      variant="clear"
                      onClick={clearCategories}
                      aria-label={t("expense.clearCategoryFilter")}
                    >
                      <X aria-hidden="true" size={14} strokeWidth={2} />
                      {t("common.clear")}
                    </Chip>
                  ) : null}
                </div>
              </fieldset>
            </div>
          ) : null}

          {group.expenses.length > 0 ? (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <p className="amount text-lg font-medium text-ink" aria-live="polite">
                {t("expense.filterSummary", {
                  count: filteredExpenses.length,
                  amount: formatCents(filteredTotalCents, group.currency, locale),
                })}
              </p>
            </div>
          ) : null}

          {group.expenses.length === 0 ? (
            <EmptyState
              title={t("expense.emptyTitle")}
              description={t("expense.emptyDescription")}
              actionHref={`/groups/${group.id}/expenses/new`}
              actionLabel={t("expense.add")}
              prominentAction
              showPlusIcon
            />
          ) : (
            <div className="space-y-8">
              {currentMember && !hasCurrentParticipation ? (
                <EmptyState
                  title={t("expense.noParticipationTitle")}
                  description={t("expense.noParticipationDescription")}
                  actionHref={`/groups/${group.id}/expenses/new`}
                  actionLabel={t("expense.addFirst")}
                  showPlusIcon
                />
              ) : null}
              {filteredExpenses.length === 0 ? (
                <div className="rounded-[14px] bg-surface px-5 py-10 text-center">
                  <p className="font-bold text-ink">{t("expense.noResults")}</p>
                  <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-ink-soft">
                    {t("expense.currentFilters", {
                      query: expenseQuery.trim()
                        ? t("expense.queryValue", { query: expenseQuery.trim() })
                        : t("expense.noQuery"),
                      categories: selectedCategories.length
                        ? t("expense.categoryValue", { categories: selectedCategories.map((category) => t(categoryKey(category))).join(locale === "zh" ? "、" : ", ") })
                        : t("expense.noCategory"),
                    })}
                  </p>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-3 rounded-full bg-surface px-4 py-2 text-sm font-bold text-ink hover:opacity-70"
                  >
                    {t("expense.clearFilters")}
                  </button>
                </div>
              ) : null}
              {groupExpensesByDate(filteredExpenses).map(([date, expenses]) => (
              <div key={date}>
                <h3 className="mb-3 text-sm font-bold text-ink-soft">
                  {formatDate(`${date}T00:00:00.000Z`, locale, { year: "numeric", month: locale === "zh" ? "long" : "short", day: "numeric", timeZone: "UTC" })}
                </h3>
                <div className="overflow-hidden rounded-[14px] bg-surface">
                  {expenses.map((expense) => {
                    const myShare = expense.shares.find(
                      (share) => share.memberId === currentMember?.id
                    );
                    const isParticipating = Boolean(myShare);

                    return (
                      <Link
                        key={expense.id}
                        href={`/expenses/${expense.id}`}
                        className={`grid min-w-0 gap-3 border-b border-line px-4 py-4 transition-colors last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5 ${
                          isParticipating
                            ? "hover:bg-inset"
                            : "bg-inset text-ink-soft hover:bg-inset"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p
                              className={`truncate font-semibold ${
                                expense.settled ? "line-through" : ""
                              }`}
                            >
                              {expense.description}
                            </p>
                            {!isParticipating ? (
                              <Chip as="span" variant="clear">{t("expense.notInvolved")}</Chip>
                            ) : null}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                            <span>
                              {t("expense.paidBy", { name: expense.paidByMemberId === currentMember?.id ? t("common.you") : expense.paidByName })}
                            </span>
                            <Chip as="span">
                              <CategoryIcon category={expense.category} />
                              {t(categoryKey(expense.category))}
                            </Chip>
                            <span>{t("expense.totalWithAmount", { amount: formatCents(expense.amountCents, group.currency, locale) })}</span>
                          </div>
                        </div>
                        <div className="min-w-0 sm:text-right">
                          <p className="text-xs text-ink-soft">{t("expense.myShare")}</p>
                          <p className="amount mt-1 text-lg font-medium">
                            {isParticipating && myShare
                              ? formatCents(myShare.amountCents, group.currency, locale)
                              : "—"}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
              ))}
            </div>
          )}
        </section>
      </div>
      <Link
        href={`/groups/${group.id}/expenses/new`}
        className="fixed bottom-6 right-4 z-40 inline-flex min-h-12 items-center gap-2 rounded-full bg-accent px-5 py-3 font-extrabold text-surface transition-transform hover:-translate-y-0.5 hover:opacity-85 sm:bottom-8 sm:right-8"
        aria-label={t("expense.addInGroup", { name: group.name })}
      >
        <Plus aria-hidden="true" size={18} strokeWidth={2} />
        {t("expense.add")}
      </Link>
    </main>
  );
}
