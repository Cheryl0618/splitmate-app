"use client";

import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { InsightsPanel } from "@/components/insights-panel";
import { UserSwitcher } from "@/components/user-switcher";
import { useCurrentUser } from "@/lib/current-user";
import { formatCents } from "@/lib/format";
import type { GroupDetailData, GroupExpenseSummary } from "@/server/group-details";

function formatDate(date: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}

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

function BalanceAmount({ amountCents }: { amountCents: number }) {
  if (amountCents > 0) {
    return <span className="font-bold text-emerald-600">+{formatCents(amountCents)}</span>;
  }
  if (amountCents < 0) {
    return <span className="font-bold text-rose-600">{formatCents(amountCents)}</span>;
  }
  return <span className="font-semibold text-slate-400">已结清</span>;
}

export function GroupDetailView({ group }: { group: GroupDetailData }) {
  const { currentUserId } = useCurrentUser();
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

  return (
    <main className="min-h-screen bg-[#f6f8f7] text-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex min-w-0 items-center gap-2 truncate text-sm font-semibold text-slate-500 hover:text-teal-700"
          >
            <span aria-hidden="true">←</span>
            所有群组
          </Link>
          <UserSwitcher users={group.users} />
        </header>

        <div className="pb-8 pt-12 sm:pt-16">
          <p className="mb-2 text-sm font-semibold text-teal-700">共享账本</p>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{group.name}</h1>
        </div>

        <div className="mb-8">
          <InsightsPanel endpoint={`/api/groups/${group.id}/insights`} />
        </div>

        {balanceTotalCents !== 0 ? (
          <div
            role="alert"
            className="mb-6 rounded-2xl border border-rose-300 bg-rose-50 px-5 py-4 font-semibold text-rose-800"
          >
            余额合计异常：{formatCents(balanceTotalCents)}，所有成员净额应合计为{" "}
            {formatCents(0)}。
          </div>
        ) : null}

        <section aria-labelledby="balances-heading">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 id="balances-heading" className="text-xl font-bold">
                成员余额
              </h2>
              <p className="mt-1 text-sm text-slate-500">正数代表应收，负数代表应付</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-400">{group.members.length} 人</span>
              <Link
                href={`/groups/${group.id}/settle`}
                className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-bold text-teal-700 hover:bg-teal-100"
              >
                去结算
              </Link>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
            {orderedBalances.map((balance) => {
              const isCurrent = balance.userId === currentUserId;
              return (
                <Link
                  key={balance.memberId}
                  href={`/groups/${group.id}/members/${balance.memberId}`}
                  className={`flex items-center justify-between border-b border-slate-100 px-5 py-4 transition-colors last:border-b-0 ${
                    isCurrent ? "bg-teal-50/80" : "hover:bg-slate-50"
                  }`}
                  aria-label={`查看与${balance.displayName}的关系画像`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`grid h-10 w-10 place-items-center rounded-full text-sm font-bold ${
                        isCurrent
                          ? "bg-teal-600 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {balance.displayName.slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <p className="font-semibold">{balance.displayName}</p>
                      {isCurrent ? (
                        <p className="text-xs font-medium text-teal-700">当前用户</p>
                      ) : null}
                    </div>
                  </div>
                  <BalanceAmount amountCents={balance.amountCents} />
                </Link>
              );
            })}
          </div>
        </section>

        <section className="pb-16 pt-12" aria-labelledby="expenses-heading">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 id="expenses-heading" className="text-xl font-bold">
                账单列表
              </h2>
              <p className="mt-1 text-sm text-slate-500">按日期查看群组内的所有支出</p>
            </div>
            <Link
              href={`/groups/${group.id}/expenses/new`}
              className="shrink-0 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-700"
            >
              记一笔
            </Link>
          </div>

          {group.expenses.length === 0 ? (
            <EmptyState
              title="这个群组还没有账单"
              description="先记下第一笔共同支出，成员余额和结算方案就会自动出现在这里。"
              actionHref={`/groups/${group.id}/expenses/new`}
              actionLabel="记录第一笔账单"
            />
          ) : (
            <div className="space-y-8">
              {currentMember && !hasCurrentParticipation ? (
                <EmptyState
                  title="你还没有参与任何账单"
                  description="群组里已经有账单，但目前都没有分摊给你。记一笔并选择自己参与，之后这里就会显示你的支出。"
                  actionHref={`/groups/${group.id}/expenses/new`}
                  actionLabel="记下我的第一笔"
                />
              ) : null}
              {groupExpensesByDate(group.expenses).map(([date, expenses]) => (
              <div key={date}>
                <h3 className="mb-3 text-sm font-bold text-slate-500">
                  {formatDate(`${date}T00:00:00.000Z`)}
                </h3>
                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
                  {expenses.map((expense) => {
                    const myShare = expense.shares.find(
                      (share) => share.memberId === currentMember?.id
                    );
                    const isParticipating = Boolean(myShare);

                    return (
                      <Link
                        key={expense.id}
                        href={`/expenses/${expense.id}`}
                        className={`grid min-w-0 gap-3 border-b border-slate-100 px-4 py-4 transition-colors last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5 ${
                          isParticipating
                            ? "hover:bg-slate-50"
                            : "bg-slate-50/70 text-slate-400 hover:bg-slate-100"
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
                              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-500">
                                未参与
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm">
                            {expense.paidByName} 付款 · 总额 {formatCents(expense.amountCents)}
                          </p>
                        </div>
                        <div className="min-w-0 sm:text-right">
                          <p className="text-xs text-slate-400">我这笔出了多少</p>
                          <p className="mt-1 font-bold">
                            {isParticipating && myShare
                              ? formatCents(myShare.amountCents)
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
    </main>
  );
}
