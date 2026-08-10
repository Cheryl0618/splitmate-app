"use client";

import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { ConsumptionSummaryPanel } from "@/components/consumption-summary-panel";
import { formatCents } from "@/lib/format";
import type { RelationshipPageData } from "@/server/relationships";

export function RelationshipView({ data }: { data: RelationshipPageData }) {
  if (data.state === "not-member") {
    return (
      <main className="min-h-screen bg-[#f6f8f7] px-4 py-12 text-slate-900">
        <div className="mx-auto max-w-3xl">
          <EmptyState
            title="你不在这个群组"
            description="返回首页打开你已加入的群组，再查看与成员之间的消费关系。"
            actionHref={`/groups/${data.groupId}`}
            actionLabel="返回群组"
          />
        </div>
      </main>
    );
  }

  if (data.state === "same-member") {
    return (
      <main className="min-h-screen bg-[#f6f8f7] px-4 py-12 text-slate-900">
        <div className="mx-auto max-w-3xl">
          <EmptyState
            title="这是你自己的成员档案"
            description="关系画像需要两位成员。返回成员列表，选择另一位成员看看你们的共同消费。"
            actionHref={`/groups/${data.groupId}`}
            actionLabel="选择其他成员"
          />
        </div>
      </main>
    );
  }

  if (data.state === "no-shared") {
    return (
      <main className="min-h-screen bg-[#f6f8f7] px-4 py-12 text-slate-900">
        <div className="mx-auto max-w-3xl">
          <EmptyState
            title="你们还没有共同账单"
            description="下一次一起消费时把你们两位都选为参与人，这里就会开始积累关系画像。"
            actionHref={`/groups/${data.groupId}/expenses/new`}
            actionLabel="记录共同消费"
          />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f8f7] text-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 lg:px-12">
        <header>
          <Link
            href={`/groups/${data.groupId}`}
            className="inline-flex min-w-0 items-center gap-2 truncate text-sm font-semibold text-slate-500 hover:text-teal-700"
          >
            <span aria-hidden="true">←</span>
            返回{data.groupName}
          </Link>
        </header>

        <div className="pb-8 pt-10 sm:pt-14">
          <p className="text-sm font-semibold text-teal-700">关系画像</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
            你和 {data.targetMemberName}
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            把垫付、实际承担和结算节奏分开看，了解你们如何一起花钱。
          </p>
        </div>

        <div className="space-y-6 pb-16">
          <ConsumptionSummaryPanel
            endpoint={`/api/groups/${data.groupId}/members/${data.targetMemberId}/insights`}
            currency={data.currency}
          />

          <section className="grid gap-4 sm:grid-cols-3" aria-label="关系概览">
            {[
              ["认识时长", data.overview.relationshipDuration],
              ["一起消费", formatCents(data.overview.totalSharedCents, data.currency)],
              ["一起花钱", `${data.overview.sharedExpenseCount} 次`],
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
                {data.recentBurden.fromMonth} 至 {data.recentBurden.toMonth}
              </p>
            </div>
            <div className="mt-6 flex h-4 w-full overflow-hidden rounded-full bg-slate-100">
              <span
                className="h-full bg-teal-600"
                style={{ width: data.recentBurden.aWidth }}
                aria-label={`你承担 ${data.recentBurden.aRatioLabel}`}
              />
              <span
                className="h-full bg-amber-400"
                style={{ width: data.recentBurden.bWidth }}
                aria-label={`${data.targetMemberName}承担 ${data.recentBurden.bRatioLabel}`}
              />
            </div>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-2xl bg-teal-50 px-4 py-3 text-teal-900">
                <p className="font-bold">
                  你承担 {data.recentBurden.aRatioLabel}
                </p>
                <p className="mt-1 text-teal-700">
                  {formatCents(data.recentBurden.aCents, data.currency)}
                </p>
              </div>
              <div className="rounded-2xl bg-amber-50 px-4 py-3 text-amber-950">
                <p className="font-bold">
                  {data.targetMemberName}承担 {data.recentBurden.bRatioLabel}
                </p>
                <p className="mt-1 text-amber-700">
                  {formatCents(data.recentBurden.bCents, data.currency)}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,0.05)] sm:p-7">
            <h2 className="text-xl font-bold">消费画像</h2>
            <p className="mt-1 text-sm text-slate-500">共同账单金额最高的三个分类</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {data.topCategories.map((category, index) => (
                <div key={category.category} className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-bold text-teal-700">TOP {index + 1}</p>
                  <p className="mt-2 text-lg font-bold">{category.category}</p>
                  <p className="mt-3 font-extrabold">{formatCents(category.cents, data.currency)}</p>
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
                  {data.settlementHabits.avgSettleDaysLabel}
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  基于 {data.settlementHabits.settledExpenseCount} 笔已结清账单
                </p>
              </div>
              <div className="rounded-2xl bg-teal-50 p-4 text-teal-950">
                <p className="text-sm font-semibold">
                  你请客 {data.settlementHabits.aPaidCount} 次
                </p>
                <p className="mt-2 text-xl font-extrabold">
                  垫付 {formatCents(data.settlementHabits.aPaidCents, data.currency)}
                </p>
              </div>
              <div className="rounded-2xl bg-amber-50 p-4 text-amber-950">
                <p className="text-sm font-semibold">
                  {data.targetMemberName}请客 {data.settlementHabits.bPaidCount} 次
                </p>
                <p className="mt-2 text-xl font-extrabold">
                  垫付 {formatCents(data.settlementHabits.bPaidCents, data.currency)}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
