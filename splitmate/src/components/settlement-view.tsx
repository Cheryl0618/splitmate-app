"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { EmptyState } from "@/components/empty-state";
import { SummaryImageExport } from "@/components/summary-image-export";
import { useCurrentUser } from "@/lib/current-user";
import { formatCents } from "@/lib/format";
import type {
  SettlementPageData,
  SettlementTransferData,
} from "@/server/settlements";

function transferKey(transfer: SettlementTransferData) {
  return `${transfer.from}:${transfer.to}:${transfer.amountCents}`;
}

function repaymentCents(value: string) {
  if (!/^\d+(?:\.\d{0,2})?$/.test(value.trim())) return Number.NaN;
  const [whole, decimal = ""] = value.trim().split(".");
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : Number.NaN;
}

function formatSettlementDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function SettlementView({ data }: { data: SettlementPageData }) {
  const router = useRouter();
  const { currentUserId } = useCurrentUser();
  const currentMember = data.members.find((member) => member.userId === currentUserId);
  const [simplified, setSimplified] = useState(true);
  const [expandedTransfer, setExpandedTransfer] = useState<string | null>(null);
  const [payingTransfer, setPayingTransfer] = useState<string | null>(null);
  const [isRefreshing, startRefresh] = useTransition();
  const [error, setError] = useState("");
  const [paymentTransfer, setPaymentTransfer] = useState<SettlementTransferData | null>(null);
  const [paymentInput, setPaymentInput] = useState("");
  const [undoingSettlement, setUndoingSettlement] = useState<string | null>(null);
  const transfers = simplified ? data.optimalTransfers : data.directTransfers;
  const orderedTransfers = [...transfers].sort((left, right) => {
    const leftRelated =
      left.from === currentMember?.id || left.to === currentMember?.id;
    const rightRelated =
      right.from === currentMember?.id || right.to === currentMember?.id;
    return Number(rightRelated) - Number(leftRelated);
  });
  const memberName = (memberId: string, fallback: string) =>
    memberId === currentMember?.id ? "你" : fallback;

  function openPayment(transfer: SettlementTransferData) {
    setPaymentTransfer(transfer);
    setPaymentInput((transfer.amountCents / 100).toFixed(2));
    setError("");
  }

  async function markPaid() {
    const transfer = paymentTransfer;
    if (!transfer) return;
    const amountCents = repaymentCents(paymentInput);
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      setError("还款金额必须大于 0 且最多保留两位小数");
      return;
    }
    if (amountCents > transfer.amountCents) {
      setError("还款金额不能超过系统建议金额");
      return;
    }
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
          amountCents,
          suggestedAmountCents: transfer.amountCents,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "确认转账失败");

      setExpandedTransfer(null);
      setPaymentTransfer(null);
      setPayingTransfer(null);
      startRefresh(() => router.refresh());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "确认转账失败");
      setPayingTransfer(null);
    }
  }

  async function undoSettlement(settlementId: string) {
    if (!window.confirm("确认撤销这条还款记录？群组余额和结算方案会立即恢复。")) {
      return;
    }
    setUndoingSettlement(settlementId);
    setError("");
    try {
      const response = await fetch(
        `/api/groups/${data.id}/settlements/${settlementId}`,
        {
          method: "DELETE",
          headers: { "x-demo-user-id": currentUserId },
        }
      );
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "撤销还款失败");
      setUndoingSettlement(null);
      startRefresh(() => router.refresh());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "撤销还款失败");
      setUndoingSettlement(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f8f7] text-slate-900">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8 lg:px-12">
        <header>
          <Link
            href={`/groups/${data.id}`}
            className="inline-flex min-w-0 items-center gap-2 truncate text-sm font-semibold text-slate-500 hover:text-teal-700"
          >
            <span aria-hidden="true">←</span>
            返回{data.name}
          </Link>
        </header>

        <div className="flex flex-wrap items-end justify-between gap-4 pb-8 pt-12 sm:pt-16">
          <div>
            <p className="mb-2 text-sm font-semibold text-teal-700">结算方案</p>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              {data.name} · 结算
            </h1>
          </div>
          <SummaryImageExport data={data.exportSummary} />
        </div>

        {data.isSettled ? (
          <EmptyState
            title="全部结清"
            description="群组内所有成员的净额都已归零。现在可以返回群组查看历史账单，下一笔支出会重新生成结算方案。"
            actionHref={`/groups/${data.id}`}
            actionLabel="返回群组查看账单"
            tone="success"
          />
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
                    <div className="flex min-w-0 flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                      <div className="flex min-w-0 items-center gap-4">
                        <span
                          className={`grid h-11 w-11 place-items-center rounded-full text-sm font-bold ${
                            isRelated
                              ? "bg-teal-600 text-white"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {memberName(transfer.from, transfer.fromName).slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="break-words font-bold">
                            {memberName(transfer.from, transfer.fromName)}{" "}
                            <span className="mx-1 text-slate-400">付给</span>{" "}
                            {memberName(transfer.to, transfer.toName)}
                          </p>
                          <p className="mt-1 text-2xl font-extrabold text-slate-900">
                            {formatCents(transfer.amountCents, data.currency)}
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
                          disabled={payingTransfer !== null || isRefreshing}
                          onClick={() => openPayment(transfer)}
                          className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          {payingTransfer === key
                            ? "确认中…"
                            : isRefreshing
                              ? "更新余额中…"
                              : "标记已支付"}
                        </button>
                      </div>
                    </div>

                    {simplified && isExpanded ? (
                      <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-6 sm:px-6">
                        <div className="grid gap-6 md:grid-cols-2">
                          <div>
                            <h3 className="font-bold text-rose-700">
                              {memberName(transfer.from, transfer.fromName)}为什么需要付款
                            </h3>
                            <p className="mt-1 font-semibold text-rose-600">
                              当前净额 {formatCents(data.balances[transfer.from] ?? 0, data.currency)}
                            </p>
                            <ul className="mt-3 space-y-2 text-sm">
                              {transfer.explanation.debtorItems.map((item) => (
                                <li
                                  key={`${item.expenseId}:${item.counterpartyName}`}
                                  className="break-words rounded-xl bg-white px-3 py-2"
                                >
                                  <Link
                                    href={`/expenses/${item.expenseId}`}
                                    className="font-semibold hover:text-teal-700"
                                  >
                                    {item.description}
                                  </Link>
                                  ：欠 {memberName(item.counterpartyId, item.counterpartyName)} {formatCents(item.amountCents, data.currency)}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <h3 className="font-bold text-emerald-700">
                              {memberName(transfer.to, transfer.toName)}为什么应该收款
                            </h3>
                            <p className="mt-1 font-semibold text-emerald-600">
                              当前净额 +{formatCents(data.balances[transfer.to] ?? 0, data.currency)}
                            </p>
                            <ul className="mt-3 space-y-2 text-sm">
                              {transfer.explanation.creditorItems.map((item) => (
                                <li key={item.expenseId} className="break-words rounded-xl bg-white px-3 py-2">
                                  <Link
                                    href={`/expenses/${item.expenseId}`}
                                    className="font-semibold hover:text-teal-700"
                                  >
                                    {item.description}
                                  </Link>
                                  ：垫付 {formatCents(item.amountCents, data.currency)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {!transfer.explanation.hasDirectDebt ? (
                          <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-900">
                            {memberName(transfer.from, transfer.fromName)}和
                            {memberName(transfer.to, transfer.toName)}之间没有直接欠款，
                            这是系统合并多笔债务后的结果。
                            {transfer.from === currentMember?.id
                              ? `转给${memberName(transfer.to, transfer.toName)}之后，你和所有人都两清了。`
                              : `${memberName(transfer.from, transfer.fromName)}完成这笔转账后会与所有人两清。`}
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

        {data.confirmedSettlements.length > 0 ? (
          <details className="mb-16 mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)] sm:p-6">
            <summary className="cursor-pointer font-bold text-slate-800">
              已确认还款记录（{data.confirmedSettlements.length}）
            </summary>
            <div className="mt-5 divide-y divide-slate-100">
              {data.confirmedSettlements.map((settlement) => (
                <div
                  key={settlement.id}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold">
                      {memberName(settlement.fromMemberId, settlement.fromName)}付给 {memberName(settlement.toMemberId, settlement.toName)}{" "}
                      {formatCents(settlement.amountCents, data.currency)}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {formatSettlementDate(settlement.confirmedAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={undoingSettlement !== null || isRefreshing}
                    onClick={() => void undoSettlement(settlement.id)}
                    className="self-start rounded-xl border border-rose-200 px-3 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
                  >
                    {undoingSettlement === settlement.id ? "撤销中…" : "撤销"}
                  </button>
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </div>

      {paymentTransfer ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4 py-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="payment-dialog-title"
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl sm:p-7">
            <h2 id="payment-dialog-title" className="text-xl font-extrabold">
              确认还款金额
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {memberName(paymentTransfer.from, paymentTransfer.fromName)}付给 {memberName(paymentTransfer.to, paymentTransfer.toName)}，系统建议全额为{" "}
              {formatCents(paymentTransfer.amountCents, data.currency)}。
            </p>
            <label className="mt-5 block text-sm font-bold text-slate-700">
              本次还款金额（{data.currency}）
              <input
                autoFocus
                inputMode="decimal"
                value={paymentInput}
                onChange={(event) => setPaymentInput(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-xl font-bold outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
            </label>
            {error ? (
              <p className="mt-3 text-sm font-semibold text-rose-600" role="alert">
                {error}
              </p>
            ) : null}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={payingTransfer !== null}
                onClick={() => setPaymentTransfer(null)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600"
              >
                取消
              </button>
              <button
                type="button"
                disabled={payingTransfer !== null}
                onClick={() => void markPaid()}
                className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {payingTransfer ? "确认中…" : "确认还款"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
