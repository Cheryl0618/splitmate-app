"use client";

import Link from "next/link";
import { ChevronLeft, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { EmptyState } from "@/components/empty-state";
import { SummaryImageExport } from "@/components/summary-image-export";
import { IconButton, IconLink } from "@/components/ui/icon-action";
import { useCurrentUser } from "@/lib/current-user";
import { formatCents, formatDate } from "@/lib/format";
import { useT } from "@/i18n/context";
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

export function SettlementView({ data }: { data: SettlementPageData }) {
  const router = useRouter();
  const { locale, t } = useT();
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
    memberId === currentMember?.id ? t("common.you") : fallback;

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
      setError(t("settle.paymentInvalid"));
      return;
    }
    if (amountCents > transfer.amountCents) {
      setError(t("settle.paymentTooHigh"));
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
          "x-ui-locale": locale,
        },
        body: JSON.stringify({
          fromMemberId: transfer.from,
          toMemberId: transfer.to,
          amountCents,
          suggestedAmountCents: transfer.amountCents,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || t("settle.confirmError"));

      setExpandedTransfer(null);
      setPaymentTransfer(null);
      setPayingTransfer(null);
      startRefresh(() => router.refresh());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("settle.confirmError"));
      setPayingTransfer(null);
    }
  }

  async function undoSettlement(settlementId: string) {
    if (!window.confirm(t("settle.undoConfirm"))) {
      return;
    }
    setUndoingSettlement(settlementId);
    setError("");
    try {
      const response = await fetch(
        `/api/groups/${data.id}/settlements/${settlementId}`,
        {
          method: "DELETE",
          headers: { "x-demo-user-id": currentUserId, "x-ui-locale": locale },
        }
      );
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || t("settle.undoError"));
      setUndoingSettlement(null);
      startRefresh(() => router.refresh());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("settle.undoError"));
      setUndoingSettlement(null);
    }
  }

  return (
    <main className="min-h-screen bg-bg text-ink">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8 lg:px-12">
        <header>
          <IconLink
            href={`/groups/${data.id}`}
            icon={ChevronLeft}
            label={t("settle.backGroup", { name: data.name })}
            className="bg-surface"
          />
        </header>

        <div className="flex flex-wrap items-end justify-between gap-4 pb-8 pt-12 sm:pt-16">
          <div>
            <p className="mb-2 text-sm font-semibold text-ink">{t("nav.settlement")}</p>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              {t("settle.title", { name: data.name })}
            </h1>
          </div>
          <SummaryImageExport data={data.exportSummary} />
        </div>

        {data.isSettled ? (
          <EmptyState
            title={t("settle.allSettled")}
            description={t("settle.allSettledDescription")}
            actionHref={`/groups/${data.id}`}
            actionLabel={t("settle.backExpenses")}
            tone="success"
          />
        ) : (
          <>
            <section className="rounded-[14px] bg-ink p-5 text-surface sm:p-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold">{t("settle.simplify")}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={simplified}
                      onClick={() => setSimplified((current) => !current)}
                      className={`relative h-7 w-12 rounded-full transition-colors ${
                        simplified ? "bg-surface" : "bg-inset"
                      }`}
                    >
                      <span
                        className={`absolute top-1 h-5 w-5 rounded-full bg-ink transition-transform ${
                          simplified ? "left-6" : "left-1"
                        }`}
                      />
                      <span className="sr-only">{t("settle.toggleSimplify")}</span>
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-ink-soft">
                    {t(simplified ? "settle.simplifiedDescription" : "settle.directDescription")}
                  </p>
                </div>
                <p className="rounded-[14px] bg-inset px-4 py-3 text-sm font-bold text-ink">
                  {t("settle.comparison", { direct: data.directTransfers.length, optimal: data.optimalTransfers.length })}
                </p>
              </div>
            </section>

            {error ? (
              <p
                className="mt-5 rounded-[14px] bg-inset px-4 py-3 font-semibold text-ink"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <section className="space-y-4 pb-16 pt-7" aria-label={t("settle.transferList")}>
              {orderedTransfers.map((transfer) => {
                const key = transferKey(transfer);
                const isRelated =
                  transfer.from === currentMember?.id || transfer.to === currentMember?.id;
                const isExpanded = expandedTransfer === key;

                return (
                  <article
                    key={key}
                    className={`overflow-hidden rounded-[14px] bg-surface ${
                      isRelated ? "bg-inset" : ""
                    }`}
                  >
                    <div className="flex min-w-0 flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                      <div className="flex min-w-0 items-center gap-4">
                        <span
                          className={`grid h-11 w-11 place-items-center rounded-full text-sm font-bold ${
                            isRelated
                              ? "bg-ink text-surface"
                              : "bg-inset text-ink-soft"
                          }`}
                        >
                          {memberName(transfer.from, transfer.fromName).slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="break-words font-bold">
                            {memberName(transfer.from, transfer.fromName)}{" "}
                            <span className="mx-1 text-ink-soft">{t("settle.pays")}</span>{" "}
                            {memberName(transfer.to, transfer.toName)}
                          </p>
                          <p className="amount mt-1 text-2xl font-medium text-ink">
                            {formatCents(transfer.amountCents, data.currency, locale)}
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
                            className="rounded-full bg-surface px-4 py-2 text-sm font-bold text-ink hover:opacity-70"
                          >
                            {t(isExpanded ? "settle.hideReason" : "settle.whyTransfer")}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={payingTransfer !== null || isRefreshing}
                          onClick={() => openPayment(transfer)}
                          className="rounded-full bg-accent px-4 py-2 text-sm font-bold text-surface hover:opacity-85 disabled:cursor-not-allowed disabled:bg-inset"
                        >
                          {payingTransfer === key
                            ? t("settle.confirming")
                            : isRefreshing
                              ? t("settle.updating")
                              : t("settle.markPaid")}
                        </button>
                      </div>
                    </div>

                    {simplified && isExpanded ? (
                      <div className="border-t border-line bg-inset px-5 py-6 sm:px-6">
                        <div className="grid gap-6 md:grid-cols-2">
                          <div>
                            <h3 className="font-bold text-ink">
                              {t("settle.whyPay", { name: memberName(transfer.from, transfer.fromName) })}
                            </h3>
                            <p className="amount mt-1 text-lg font-medium text-accent">
                              {t("settle.currentBalance", { amount: formatCents(data.balances[transfer.from] ?? 0, data.currency, locale) })}
                            </p>
                            <ul className="mt-3 space-y-2 text-sm">
                              {transfer.explanation.debtorItems.map((item) => (
                                <li
                                  key={`${item.expenseId}:${item.counterpartyName}`}
                                  className="break-words rounded-[14px] bg-surface px-3 py-2"
                                >
                                  <Link
                                    href={`/expenses/${item.expenseId}`}
                                    className="font-semibold hover:text-ink"
                                  >
                                    {item.description}
                                  </Link>
                                  {t("settle.owesItem", { name: memberName(item.counterpartyId, item.counterpartyName), amount: formatCents(item.amountCents, data.currency, locale) })}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <h3 className="font-bold text-ink">
                              {t("settle.whyReceive", { name: memberName(transfer.to, transfer.toName) })}
                            </h3>
                            <p className="amount mt-1 text-lg font-medium text-ink">
                              {t("settle.currentBalance", { amount: `+${formatCents(data.balances[transfer.to] ?? 0, data.currency, locale)}` })}
                            </p>
                            <ul className="mt-3 space-y-2 text-sm">
                              {transfer.explanation.creditorItems.map((item) => (
                                <li key={item.expenseId} className="break-words rounded-[14px] bg-surface px-3 py-2">
                                  <Link
                                    href={`/expenses/${item.expenseId}`}
                                    className="font-semibold hover:text-ink"
                                  >
                                    {item.description}
                                  </Link>
                                  {t("settle.paidItem", { amount: formatCents(item.amountCents, data.currency, locale) })}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {!transfer.explanation.hasDirectDebt ? (
                          <p className="mt-5 rounded-[14px] bg-inset px-4 py-3 text-sm font-semibold leading-6 text-ink">
                            {t("settle.explanation.noDirectDebt", {
                              from: memberName(transfer.from, transfer.fromName),
                              to: memberName(transfer.to, transfer.toName),
                              outcome: transfer.from === currentMember?.id
                                ? t("settle.explanation.youSettle", { name: memberName(transfer.to, transfer.toName) })
                                : t("settle.explanation.memberSettles", { name: memberName(transfer.from, transfer.fromName) }),
                            })}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}

              {orderedTransfers.length === 0 ? (
                <div className="rounded-[14px] bg-inset px-6 py-8 text-center font-semibold text-ink">
                  {t("settle.noPlan")}
                </div>
              ) : null}
            </section>
          </>
        )}

        {data.confirmedSettlements.length > 0 ? (
          <details className="mb-16 mt-8 rounded-[14px] bg-surface p-5 sm:p-6">
            <summary className="cursor-pointer font-bold text-ink">
              {t("settle.confirmedRecords", { count: data.confirmedSettlements.length })}
            </summary>
            <div className="mt-5 divide-y divide-line">
              {data.confirmedSettlements.map((settlement) => (
                <div
                  key={settlement.id}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold">
                      {memberName(settlement.fromMemberId, settlement.fromName)} {t("settle.pays")} {memberName(settlement.toMemberId, settlement.toName)}{" "}
                      <span className="amount text-lg font-medium">
                        {formatCents(settlement.amountCents, data.currency, locale)}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-ink-soft">
                      {formatDate(settlement.confirmedAt, locale, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <IconButton
                    icon={RotateCcw}
                    label={
                      undoingSettlement === settlement.id
                        ? t("settle.undoing")
                        : t("settle.undo")
                    }
                    disabled={undoingSettlement !== null || isRefreshing}
                    onClick={() => void undoSettlement(settlement.id)}
                    className="self-start bg-surface sm:self-auto"
                  />
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </div>

      {paymentTransfer ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/40 px-4 py-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="payment-dialog-title"
        >
          <div className="w-full max-w-md rounded-[14px] bg-surface p-5 sm:p-7">
            <h2 id="payment-dialog-title" className="text-xl font-extrabold">
              {t("settle.confirmAmount")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
              {t("settle.suggestedPayment", { from: memberName(paymentTransfer.from, paymentTransfer.fromName), to: memberName(paymentTransfer.to, paymentTransfer.toName) })}{" "}
              <span className="amount text-base font-medium text-ink">
                {formatCents(paymentTransfer.amountCents, data.currency, locale)}
              </span>
              。
            </p>
            <label className="mt-5 block text-sm font-bold text-ink">
              {t("settle.paymentAmount", { currency: data.currency })}
              <input
                autoFocus
                inputMode="decimal"
                value={paymentInput}
                onChange={(event) => setPaymentInput(event.target.value)}
                className="amount mt-2 w-full rounded-[14px] border border-line px-4 py-3 text-xl font-medium outline-none focus:border-line focus:ring-2 focus:ring-ink"
              />
            </label>
            {error ? (
              <p className="mt-3 text-sm font-semibold text-ink" role="alert">
                {error}
              </p>
            ) : null}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={payingTransfer !== null}
                onClick={() => setPaymentTransfer(null)}
                className="rounded-full bg-surface px-4 py-2.5 text-sm font-bold text-ink hover:opacity-70"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                disabled={payingTransfer !== null}
                onClick={() => void markPaid()}
                className="rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-surface hover:opacity-85 disabled:cursor-not-allowed disabled:bg-inset"
              >
                {t(payingTransfer ? "settle.confirming" : "settle.confirmPayment")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
