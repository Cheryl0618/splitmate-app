/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";

import { ExpenseActions } from "@/components/expense-actions";
import { PerspectiveInitial, PerspectiveName } from "@/components/perspective-name";
import { formatCents } from "@/lib/format";
import { getExpenseDetail } from "@/server/expenses";

function formatDate(date: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}

export default async function ExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const expense = getExpenseDetail(id);
  if (!expense) notFound();

  const shareTotalCents = expense.shares.reduce(
    (total, share) => total + share.amountCents,
    0
  );
  const sharesMatch = shareTotalCents === expense.amountCents;

  return (
    <main className="min-h-screen bg-[#f6f8f7] text-slate-900">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 lg:px-12">
        <Link
          href={`/groups/${expense.groupId}`}
          className="inline-flex max-w-full items-center gap-2 truncate text-sm font-semibold text-slate-500 hover:text-teal-700"
        >
          <span aria-hidden="true">←</span>
          返回{expense.groupName}
        </Link>
        <ExpenseActions
          expenseId={expense.id}
          groupId={expense.groupId}
          createdById={expense.createdById}
        />

        <article className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.07)]">
          <header className="border-b border-slate-100 px-5 py-7 sm:px-8">
            <p className="text-sm font-semibold text-teal-700">账单详情</p>
            <h1
              className={`mt-2 text-3xl font-extrabold tracking-tight ${
                expense.settled ? "text-slate-400 line-through" : ""
              }`}
            >
              {expense.description}
            </h1>
            <p className="mt-5 text-4xl font-black tracking-tight">
              {formatCents(expense.amountCents, expense.currency)}
            </p>
            <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-400">日期</dt>
                <dd className="mt-1 font-semibold">{formatDate(expense.date)}</dd>
              </div>
              <div>
                <dt className="text-slate-400">付款人</dt>
                <dd className="mt-1 font-semibold">
                  <PerspectiveName
                    userId={expense.paidByUserId}
                    displayName={expense.paidByName}
                  />
                </dd>
              </div>
            </dl>
          </header>

          <section className="px-5 py-7 sm:px-8" aria-labelledby="shares-heading">
            <h2 id="shares-heading" className="text-lg font-bold">
              分摊明细
            </h2>
            <div className="mt-4 divide-y divide-slate-100">
              {expense.shares.map((share) => (
                <div key={share.memberId} className="flex min-w-0 items-center justify-between gap-3 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                      <PerspectiveInitial userId={share.userId} displayName={share.displayName} />
                    </span>
                    <span className="truncate font-semibold">
                      <PerspectiveName userId={share.userId} displayName={share.displayName} />
                    </span>
                  </div>
                  <span className="shrink-0 font-bold">{formatCents(share.amountCents, expense.currency)}</span>
                </div>
              ))}
            </div>

            <div
              className={`mt-5 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                sharesMatch
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-rose-300 bg-rose-50 text-rose-800"
              }`}
              role={sharesMatch ? undefined : "alert"}
            >
              份额合计 {formatCents(shareTotalCents, expense.currency)} = 总额{" "}
              {formatCents(expense.amountCents, expense.currency)}
            </div>
          </section>

          {expense.photoUrls.length > 0 ? (
            <section className="border-t border-slate-100 px-5 py-7 sm:px-8">
              <h2 className="text-lg font-bold">收据原图</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {expense.photoUrls.map((photoUrl, index) => (
                  <img
                    key={`${photoUrl}:${index}`}
                    src={photoUrl}
                    alt={`收据原图 ${index + 1}`}
                    className="w-full rounded-2xl border border-slate-200 object-contain"
                  />
                ))}
              </div>
            </section>
          ) : null}
        </article>
      </div>
    </main>
  );
}
