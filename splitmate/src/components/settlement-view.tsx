"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { UserSwitcher } from "@/components/user-switcher";
import { useCurrentUser } from "@/lib/current-user";
import { formatCents } from "@/lib/format";
import type {
  SettlementPageData,
  SettlementTransferData,
} from "@/server/settlements";

function transferKey(transfer: SettlementTransferData) {
  return `${transfer.from}:${transfer.to}:${transfer.amountCents}`;
}

export function SettlementView({ data }: { data: SettlementPageData }) {
  const router = useRouter();
  const { currentUserId } = useCurrentUser();
  const currentMember = data.members.find((member) => member.userId === currentUserId);
  const [simplified, setSimplified] = useState(true);
  const [expandedTransfer, setExpandedTransfer] = useState<string | null>(null);
  const [payingTransfer, setPayingTransfer] = useState<string | null>(null);
  const [error, setError] = useState("");
  const transfers = simplified ? data.optimalTransfers : data.directTransfers;
  const orderedTransfers = [...transfers].sort((left, right) => {
    const leftRelated =
      left.from === currentMember?.id || left.to === currentMember?.id;
    const rightRelated =
      right.from === currentMember?.id || right.to === currentMember?.id;
    return Number(rightRelated) - Number(leftRelated);
  });

  async function markPaid(transfer: SettlementTransferData) {
    const confirmed = window.confirm(
      `确认 ${transfer.fromName} 已向 ${transfer.toName} 支付 ${formatCents(transfer.amountCents)}？这个操作会更新所有人的余额。`
    );
    if (!confirmed) return;

    const key = transferKey(transfer);
    setPayingTransfer(key);
    setError("");
    try {
      const response = await fetch(`/api/groups/${data.id}/settlements`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-demo-user-id": currentUserId,
        },
        body: JSON.stringify({
          fromMemberId: transfer.from,
          toMemberId: transfer.to,
          amountCents: transfer.amountCents,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "确认转账失败");

      setExpandedTransfer(null);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "确认转账失败");
      setPayingTransfer(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f8f7] text-slate-900">
      <div className="mx-auto max-w-4xl px-5 py-6 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between gap-4">
          <Link
            href={`/groups/${data.id}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-teal-700"
          >
            <span aria-hidden="true">←</span>
            返回{data.name}
          </Link>
          <UserSwitcher users={data.users} />
        </header>

        <div className="pb-8 pt-12 sm:pt-16">
          <p className="mb-2 text-sm font-semibold text-teal-700">结算方案</p>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            {data.name} · 结算
          </h1>
        </div>

        {data.isSettled ? (
          <section className="rounded-3xl border border-emerald-200 bg-emerald-50 px-6 py-12 text-center shadow-[0_14px_40px_rgba(15,23,42,0.04)]">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-600 text-3xl text-white">
              ✓
            </span>
            <h2 className="mt-5 text-2xl font-extrabold text-emerald-900">全部结清</h2>
            <p className="mt-2 text-emerald-700">群组内所有成员的净额都已归零。</p>
          </section>
        ) : (
          <>
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.05)] sm:p-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold">简化债务</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={simplified}
                      onClick={() => setSimplified((current) => !current)}
                      className={`relative h-7 w-12 rounded-full transition-colors ${
                        simplified ? "bg-teal-600" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                          simplified ? "left-6" : "left-1"
                        }`}
                      />
                      <span className="sr-only">切换简化债务</span>
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {simplified ? "系统寻找转账笔数最少的方案" : "保留每一对成员的原始欠款关系"}
                  </p>
                </div>
                <p className="rounded-2xl bg-teal-50 px-4 py-3 text-sm font-bold text-teal-800">
                  直接结算需要 {data.directTransfers.length} 笔，简化后只要{" "}
                  {data.optimalTransfers.length} 笔
                </p>
              </div>
            </section>

            {error ? (
              <p
                className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 font-semibold text-rose-700"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <section className="space-y-4 pb-16 pt-7" aria-label="转账列表">
              {orderedTransfers.map((transfer) => {
                const key = transferKey(transfer);
                const isRelated =
                  transfer.from === currentMember?.id || transfer.to === currentMember?.id;
                const isExpanded = expandedTransfer === key;

                return (
                  <article
                    key={key}
                    className={`overflow-hidden rounded-3xl border bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)] ${
                      isRelated ? "border-teal-300 ring-2 ring-teal-100" : "border-slate-200"
                    }`}
                  >
                    <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                      <div className="flex items-center gap-4">
                        <span
                          className={`grid h-11 w-11 place-items-center rounded-full text-sm font-bold ${
                            isRelated
                              ? "bg-teal-600 text-white"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {transfer.fromName.slice(0, 1).toUpperCase()}
                        </span>
                        <div>
                          <p className="font-bold">
                            {transfer.fromName}{" "}
                            <span className="mx-1 text-slate-400">付给</span>{" "}
                            {transfer.toName}
                          </p>
                          <p className="mt-1 text-2xl font-extrabold text-slate-900">
                            {formatCents(transfer.amountCents)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {simplified ? (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedTransfer(isExpanded ? null : key)
                            }
                            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
                          >
                            {isExpanded ? "收起原因" : "为什么这样转？"}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={payingTransfer !== null}
                          onClick={() => markPaid(transfer)}
                          className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          {payingTransfer === key ? "确认中…" : "标记已支付"}
                        </button>
                      </div>
                    </div>

                    {simplified && isExpanded ? (
                      <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-6 sm:px-6">
                        <div className="grid gap-6 md:grid-cols-2">
                          <div>
                            <h3 className="font-bold text-rose-700">
                              {transfer.fromName} 为什么需要付款
                            </h3>
                            <p className="mt-1 text-sm text-slate-500">
                              当前净额 {formatCents(data.balances[transfer.from] ?? 0)}
                            </p>
                            <ul className="mt-3 space-y-2 text-sm">
                              {transfer.explanation.debtorItems.map((item) => (
                                <li
                                  key={`${item.expenseId}:${item.counterpartyName}`}
                                  className="rounded-xl bg-white px-3 py-2"
                                >
                                  <Link
                                    href={`/expenses/${item.expenseId}`}
                                    className="font-semibold hover:text-teal-700"
                                  >
                                    {item.description}
                                  </Link>
                                  ：欠 {item.counterpartyName} {formatCents(item.amountCents)}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <h3 className="font-bold text-emerald-700">
                              {transfer.toName} 为什么应该收款
                            </h3>
                            <p className="mt-1 text-sm text-slate-500">
                              当前净额 +{formatCents(data.balances[transfer.to] ?? 0)}
                            </p>
                            <ul className="mt-3 space-y-2 text-sm">
                              {transfer.explanation.creditorItems.map((item) => (
                                <li key={item.expenseId} className="rounded-xl bg-white px-3 py-2">
                                  <Link
                                    href={`/expenses/${item.expenseId}`}
                                    className="font-semibold hover:text-teal-700"
                                  >
                                    {item.description}
                                  </Link>
                                  ：垫付 {formatCents(item.amountCents)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {!transfer.explanation.hasDirectDebt ? (
                          <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-900">
                            {transfer.from === currentMember?.id
                              ? `你和 ${transfer.toName}`
                              : `${transfer.fromName} 和 ${transfer.toName}`}
                            之间没有直接欠款，这是系统合并多笔债务后的结果，转给
                            {transfer.toName} 之后你和所有人都两清了。
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}

              {orderedTransfers.length === 0 ? (
                <div className="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-8 text-center font-semibold text-amber-900">
                  当前余额尚未归零，但没有可用的转账方案，请检查账单数据。
                </div>
              ) : null}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
