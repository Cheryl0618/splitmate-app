"use client";

import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { UserSwitcher } from "@/components/user-switcher";
import { useCurrentUser } from "@/lib/current-user";
import { formatCents } from "@/lib/format";
import { computeRelationship } from "@/lib/relationship";
import type { RelationshipPageData } from "@/server/relationships";

function relationshipDuration(firstExpenseAt: Date) {
  const now = new Date();
  const months = Math.max(
    1,
    (now.getUTCFullYear() - firstExpenseAt.getUTCFullYear()) * 12 +
      now.getUTCMonth() -
      firstExpenseAt.getUTCMonth()
  );
  if (months < 12) return `${months} 个月`;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return remainingMonths > 0 ? `${years} 年 ${remainingMonths} 个月` : `${years} 年`;
}

function percentage(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function RelationshipView({ data }: { data: RelationshipPageData }) {
  const { currentUserId } = useCurrentUser();
  const currentMember = data.members.find(
    (member) => member.userId === currentUserId
  );

  if (!currentMember) {
    return (
      <main className="min-h-screen bg-[#f6f8f7] px-4 py-12 text-slate-900">
        <div className="mx-auto max-w-3xl">
          <EmptyState
            title="当前用户不在这个群组"
            description="切换到群组内的账号后，就能查看与成员之间的消费关系。"
            actionHref={`/groups/${data.group.id}`}
            actionLabel="返回群组"
          />
        </div>
      </main>
    );
  }

  if (currentMember.id === data.targetMember.id) {
    return (
      <main className="min-h-screen bg-[#f6f8f7] px-4 py-12 text-slate-900">
        <div className="mx-auto max-w-3xl">
          <EmptyState
            title="这是你自己的成员档案"
            description="关系画像需要两位成员。返回成员列表，选择另一位成员看看你们的共同消费。"
            actionHref={`/groups/${data.group.id}`}
            actionLabel="选择其他成员"
          />
        </div>
      </main>
    );
  }

  const stats = computeRelationship(
    data.expenses,
    data.settlements,
    currentMember.id,
    data.targetMember.id
  );
  const recentMonths = stats.monthlyTrend.slice(-3);
  const recentACents = recentMonths.reduce(
    (total, month) => total + month.aCents,
    0
  );
  const recentBCents = recentMonths.reduce(
    (total, month) => total + month.bCents,
    0
  );
  const recentTotalCents = recentACents + recentBCents;
  const recentARatio = recentTotalCents > 0 ? recentACents / recentTotalCents : 0;
  const recentBRatio = recentTotalCents > 0 ? 1 - recentARatio : 0;

  return (
    <main className="min-h-screen bg-[#f6f8f7] text-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between gap-3">
          <Link
            href={`/groups/${data.group.id}`}
            className="inline-flex min-w-0 items-center gap-2 truncate text-sm font-semibold text-slate-500 hover:text-teal-700"
          >
            <span aria-hidden="true">←</span>
            返回{data.group.name}
          </Link>
          <UserSwitcher users={data.users} />
        </header>

        <div className="pb-8 pt-10 sm:pt-14">
          <p className="text-sm font-semibold text-teal-700">关系画像</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
            你和 {data.targetMember.displayName}
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            把垫付、实际承担和结算节奏分开看，了解你们如何一起花钱。
          </p>
        </div>

        {stats.sharedExpenseCount === 0 ? (
          <EmptyState
            title="你们还没有共同账单"
            description="下一次一起消费时把你们两位都选为参与人，这里就会开始积累关系画像。"
            actionHref={`/groups/${data.group.id}/expenses/new`}
            actionLabel="记录共同消费"
          />
        ) : (
          <div className="space-y-6 pb-16">
            <section className="grid gap-4 sm:grid-cols-3" aria-label="关系概览">
              {[
                ["认识时长", relationshipDuration(stats.firstSharedExpenseAt)],
                ["一起消费", formatCents(stats.totalSharedCents)],
                ["一起花钱", `${stats.sharedExpenseCount} 次`],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,0.05)]"
                >
                  <p className="text-sm font-semibold text-slate-400">{label}</p>
                  <p className="mt-3 text-2xl font-extrabold tracking-tight">{value}</p>
                </div>
              ))}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,0.05)] sm:p-7">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">最近三个月承担比例</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    承担是最终该谁出，不等同于当时谁先付款。
                  </p>
                </div>
                <p className="text-sm font-semibold text-slate-400">
                  {recentMonths[0]?.month} 至 {recentMonths.at(-1)?.month}
                </p>
              </div>
              <div className="mt-6 flex h-4 w-full overflow-hidden rounded-full bg-slate-100">
                <span
                  className="h-full bg-teal-600 transition-[width]"
                  style={{ width: percentage(recentARatio) }}
                  aria-label={`你承担 ${percentage(recentARatio)}`}
                />
                <span
                  className="h-full bg-amber-400 transition-[width]"
                  style={{ width: percentage(recentBRatio) }}
                  aria-label={`${data.targetMember.displayName}承担 ${percentage(recentBRatio)}`}
                />
              </div>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-2xl bg-teal-50 px-4 py-3 text-teal-900">
                  <p className="font-bold">你承担 {percentage(recentARatio)}</p>
                  <p className="mt-1 text-teal-700">{formatCents(recentACents)}</p>
                </div>
                <div className="rounded-2xl bg-amber-50 px-4 py-3 text-amber-950">
                  <p className="font-bold">
                    {data.targetMember.displayName}承担 {percentage(recentBRatio)}
                  </p>
                  <p className="mt-1 text-amber-700">{formatCents(recentBCents)}</p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,0.05)] sm:p-7">
              <h2 className="text-xl font-bold">消费画像</h2>
              <p className="mt-1 text-sm text-slate-500">共同账单金额最高的三个分类</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {stats.topCategories.map((category, index) => (
                  <div key={category.category} className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-bold text-teal-700">TOP {index + 1}</p>
                    <p className="mt-2 text-lg font-bold">{category.category}</p>
                    <p className="mt-3 font-extrabold">{formatCents(category.cents)}</p>
                    <p className="mt-1 text-sm text-slate-500">{category.count} 笔</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,0.05)] sm:p-7">
              <h2 className="text-xl font-bold">结算习惯</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-500">平均多久结清</p>
                  <p className="mt-2 text-2xl font-extrabold">
                    {stats.settledExpenseCount > 0
                      ? `${stats.avgSettleDays.toFixed(1)} 天`
                      : "尚无记录"}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    基于 {stats.settledExpenseCount} 笔已结清账单
                  </p>
                </div>
                <div className="rounded-2xl bg-teal-50 p-4 text-teal-950">
                  <p className="text-sm font-semibold">你请客 {stats.aPaidCount} 次</p>
                  <p className="mt-2 text-xl font-extrabold">
                    垫付 {formatCents(stats.aPaidCents)}
                  </p>
                </div>
                <div className="rounded-2xl bg-amber-50 p-4 text-amber-950">
                  <p className="text-sm font-semibold">
                    {data.targetMember.displayName}请客 {stats.bPaidCount} 次
                  </p>
                  <p className="mt-2 text-xl font-extrabold">
                    垫付 {formatCents(stats.bPaidCents)}
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
