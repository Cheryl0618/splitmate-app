"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useCurrentUser } from "@/lib/current-user";
import type { ExpenseInput } from "@/lib/expense-input";
import { formatCents } from "@/lib/format";
import {
  calculateShares,
  type SplitMethod,
  type SplitParticipant,
} from "@/lib/split";
import type { ExpenseFormGroupData } from "@/server/expenses";

export interface ExpenseFormInitialValue {
  id: string;
  amountCents: number;
  description: string;
  date: string;
  paidBy: string;
  method: SplitMethod;
  shares: Array<{ memberId: string; amountCents: number }>;
}

interface ParsedYuanInput {
  value: string;
  amountCents: number;
  truncated: boolean;
}

function parseYuanInput(rawValue: string): ParsedYuanInput {
  const sanitized = rawValue.replace(/[^\d.]/g, "");
  const dotIndex = sanitized.indexOf(".");
  const wholeRaw = dotIndex >= 0 ? sanitized.slice(0, dotIndex) : sanitized;
  const decimalRaw = dotIndex >= 0 ? sanitized.slice(dotIndex + 1).replaceAll(".", "") : "";
  const whole = wholeRaw.replace(/^0+(?=\d)/, "") || (dotIndex >= 0 ? "0" : "");
  const decimal = decimalRaw.slice(0, 2);
  const value = dotIndex >= 0 ? `${whole}.${decimal}` : whole;
  const amountCents =
    (whole ? Number(whole) * 100 : 0) +
    (decimal ? Number(decimal.padEnd(2, "0")) : 0);

  return {
    value,
    amountCents: Number.isSafeInteger(amountCents) ? amountCents : 0,
    truncated: decimalRaw.length > 2,
  };
}

function todayInputValue() {
  const today = new Date();
  const offset = today.getTimezoneOffset() * 60_000;
  return new Date(today.getTime() - offset).toISOString().slice(0, 10);
}

function equalPercentages(memberIds: string[]) {
  if (memberIds.length === 0) return {};
  const base = Math.floor(10_000 / memberIds.length);
  let remainder = 10_000 - base * memberIds.length;
  return Object.fromEntries(
    memberIds.map((memberId) => {
      const basisPoints = base + (remainder-- > 0 ? 1 : 0);
      return [memberId, (basisPoints / 100).toFixed(2)];
    })
  );
}

function initialPercentages(initialValue: ExpenseFormInitialValue | undefined) {
  if (!initialValue || initialValue.amountCents <= 0) return {};

  let allocated = 0;
  return Object.fromEntries(
    initialValue.shares.map((share, index) => {
      const isLast = index === initialValue.shares.length - 1;
      const percentage = isLast
        ? 100 - allocated
        : Number(((share.amountCents / initialValue.amountCents) * 100).toFixed(2));
      allocated += percentage;
      return [share.memberId, percentage.toFixed(2)];
    })
  );
}

function formatPercentage(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "");
}

export function ExpenseForm({
  group,
  initialValue,
}: {
  group: ExpenseFormGroupData;
  initialValue?: ExpenseFormInitialValue;
}) {
  const router = useRouter();
  const { currentUserId } = useCurrentUser();
  const currentMember = group.members.find((member) => member.userId === currentUserId);
  const initialMemberIds = initialValue
    ? initialValue.shares.map((share) => share.memberId)
    : group.members.map((member) => member.id);
  const [amountInput, setAmountInput] = useState(
    initialValue ? (initialValue.amountCents / 100).toFixed(2) : ""
  );
  const [amountCents, setAmountCents] = useState(initialValue?.amountCents ?? 0);
  const [amountNotice, setAmountNotice] = useState("");
  const [description, setDescription] = useState(initialValue?.description ?? "");
  const [date, setDate] = useState(initialValue?.date ?? todayInputValue());
  const [paidBy, setPaidBy] = useState(
    initialValue?.paidBy ?? currentMember?.id ?? group.members[0]?.id ?? ""
  );
  const [method, setMethod] = useState<SplitMethod>(initialValue?.method ?? "equal");
  const [selectedMemberIds, setSelectedMemberIds] = useState(initialMemberIds);
  const [percentageInputs, setPercentageInputs] = useState<Record<string, string>>(
    initialValue?.method === "percentage"
      ? initialPercentages(initialValue)
      : equalPercentages(initialMemberIds)
  );
  const [amountInputs, setAmountInputs] = useState<Record<string, string>>(
    Object.fromEntries(
      group.members.map((member) => [
        member.id,
        initialValue?.shares.find((share) => share.memberId === member.id)
          ? (
              (initialValue.shares.find((share) => share.memberId === member.id)
                ?.amountCents ?? 0) / 100
            ).toFixed(2)
          : "0.00",
      ])
    )
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const selectedMembers = group.members.filter((member) =>
    selectedMemberIds.includes(member.id)
  );
  const percentageTotal = selectedMembers.reduce(
    (total, member) => total + (Number(percentageInputs[member.id]) || 0),
    0
  );
  const assignedAmountCents = selectedMembers.reduce(
    (total, member) => total + parseYuanInput(amountInputs[member.id] ?? "").amountCents,
    0
  );

  const participants: SplitParticipant[] = selectedMembers.map((member) => ({
    memberId: member.id,
    percentage:
      method === "percentage"
        ? Number(percentageInputs[member.id]) || 0
        : undefined,
    amountCents:
      method === "amount"
        ? parseYuanInput(amountInputs[member.id] ?? "").amountCents
        : undefined,
  }));

  const calculatedShares = (() => {
    if (amountCents < 0 || participants.length === 0) return null;
    try {
      return calculateShares(amountCents, method, participants);
    } catch {
      return null;
    }
  })();

  const percentageDifference = 100 - percentageTotal;
  const amountDifferenceCents = amountCents - assignedAmountCents;
  const allocationError =
    method === "percentage" && Math.abs(percentageDifference) > 1e-9
      ? percentageDifference > 0
        ? `还差 ${formatPercentage(percentageDifference)}%`
        : `超出 ${formatPercentage(Math.abs(percentageDifference))}%`
      : method === "amount" && amountDifferenceCents !== 0
        ? amountDifferenceCents > 0
          ? `还差 ${formatCents(amountDifferenceCents)}`
          : `超出 ${formatCents(Math.abs(amountDifferenceCents))}`
        : "";
  const canSubmit =
    amountCents > 0 &&
    description.trim().length > 0 &&
    Boolean(date) &&
    Boolean(paidBy) &&
    participants.length > 0 &&
    calculatedShares !== null &&
    !allocationError &&
    !isSubmitting;

  function toggleMember(memberId: string) {
    setSelectedMemberIds((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId]
    );
  }

  function changeMethod(nextMethod: SplitMethod) {
    setMethod(nextMethod);
    if (nextMethod === "percentage") {
      setPercentageInputs((current) => {
        const hasValues = selectedMemberIds.some((memberId) => current[memberId]);
        return hasValues ? current : equalPercentages(selectedMemberIds);
      });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setSubmitError("");
    const payload: ExpenseInput = {
      amountCents,
      description: description.trim(),
      date,
      paidBy,
      method,
      participants,
    };
    const endpoint = initialValue
      ? `/api/expenses/${initialValue.id}`
      : `/api/groups/${group.id}/expenses`;

    try {
      const response = await fetch(endpoint, {
        method: initialValue ? "PUT" : "POST",
        headers: {
          "content-type": "application/json",
          "x-demo-user-id": currentUserId,
        },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: string; expenseId?: string };
      if (!response.ok) throw new Error(result.error || "保存账单失败");

      router.push(initialValue ? `/expenses/${initialValue.id}` : `/groups/${group.id}`);
      router.refresh();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "保存账单失败");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f8f7] text-slate-900">
      <div className="mx-auto max-w-3xl px-5 py-6 sm:px-8 lg:px-12">
        <Link
          href={initialValue ? `/expenses/${initialValue.id}` : `/groups/${group.id}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-teal-700"
        >
          <span aria-hidden="true">←</span>
          取消并返回
        </Link>

        <div className="pb-7 pt-10">
          <p className="text-sm font-semibold text-teal-700">{group.name}</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
            {initialValue ? "编辑账单" : "新建账单"}
          </h1>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_50px_rgba(15,23,42,0.06)] sm:p-8"
        >
          <div>
            <label htmlFor="amount" className="text-sm font-bold text-slate-700">
              金额（元）
            </label>
            <div className="mt-2 flex items-center rounded-2xl border border-slate-200 px-4 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-100">
              <span className="text-xl font-bold text-slate-400">¥</span>
              <input
                id="amount"
                inputMode="decimal"
                placeholder="0.00"
                value={amountInput}
                onChange={(event) => {
                  const parsed = parseYuanInput(event.target.value);
                  setAmountInput(parsed.value);
                  setAmountCents(parsed.amountCents);
                  setAmountNotice(parsed.truncated ? "最多保留两位小数，已自动截断。" : "");
                }}
                className="min-w-0 flex-1 bg-transparent px-3 py-4 text-2xl font-bold outline-none"
              />
            </div>
            {amountNotice ? (
              <p className="mt-2 text-sm font-medium text-amber-700">{amountNotice}</p>
            ) : null}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="description" className="text-sm font-bold text-slate-700">
                说明
              </label>
              <input
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="例如：周末超市采购"
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
            </div>
            <div>
              <label htmlFor="date" className="text-sm font-bold text-slate-700">
                日期
              </label>
              <input
                id="date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
            </div>
          </div>

          <div>
            <label htmlFor="payer" className="text-sm font-bold text-slate-700">
              付款人
            </label>
            <select
              id="payer"
              value={paidBy}
              onChange={(event) => setPaidBy(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            >
              {group.members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                </option>
              ))}
            </select>
          </div>

          <fieldset>
            <legend className="text-sm font-bold text-slate-700">参与人</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {group.members.map((member) => {
                const selected = selectedMemberIds.includes(member.id);
                return (
                  <label
                    key={member.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 ${
                      selected
                        ? "border-teal-300 bg-teal-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleMember(member.id)}
                      className="h-4 w-4 accent-teal-600"
                    />
                    <span className="font-semibold">{member.displayName}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-bold text-slate-700">分摊方式</legend>
            <div className="mt-3 grid grid-cols-3 rounded-2xl bg-slate-100 p-1">
              {(
                [
                  ["equal", "均分"],
                  ["percentage", "按比例"],
                  ["amount", "按金额"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => changeMethod(value)}
                  className={`rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
                    method === value
                      ? "bg-white text-teal-700 shadow-sm"
                      : "text-slate-500"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            {selectedMembers.length === 0 ? (
              <p className="px-4 py-5 text-center text-sm font-semibold text-rose-600">
                请至少选择一名参与人
              </p>
            ) : (
              selectedMembers.map((member) => {
                const percentage = Number(percentageInputs[member.id]) || 0;
                const previewCents =
                  calculatedShares?.[member.id] ??
                  (method === "percentage"
                    ? Math.floor((amountCents * percentage) / 100)
                    : parseYuanInput(amountInputs[member.id] ?? "").amountCents);

                return (
                  <div
                    key={member.id}
                    className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-slate-100 px-4 py-3 last:border-b-0"
                  >
                    <span className="font-semibold">{member.displayName}</span>
                    {method === "equal" ? (
                      <span className="font-bold">{formatCents(previewCents)}</span>
                    ) : method === "percentage" ? (
                      <div className="flex items-center gap-3">
                        <label className="flex items-center rounded-xl border border-slate-200 px-3 py-2">
                          <input
                            inputMode="decimal"
                            aria-label={`${member.displayName}的百分比`}
                            value={percentageInputs[member.id] ?? ""}
                            onChange={(event) =>
                              setPercentageInputs((current) => ({
                                ...current,
                                [member.id]: event.target.value.replace(/[^\d.]/g, ""),
                              }))
                            }
                            className="w-16 bg-transparent text-right font-semibold outline-none"
                          />
                          <span className="ml-1 text-slate-400">%</span>
                        </label>
                        <span className="w-20 text-right text-sm font-semibold text-slate-500">
                          {formatCents(previewCents)}
                        </span>
                      </div>
                    ) : (
                      <label className="flex items-center rounded-xl border border-slate-200 px-3 py-2">
                        <span className="text-slate-400">¥</span>
                        <input
                          inputMode="decimal"
                          aria-label={`${member.displayName}承担的金额`}
                          value={amountInputs[member.id] ?? ""}
                          onChange={(event) => {
                            const parsed = parseYuanInput(event.target.value);
                            setAmountInputs((current) => ({
                              ...current,
                              [member.id]: parsed.value,
                            }));
                          }}
                          className="ml-1 w-24 bg-transparent text-right font-semibold outline-none"
                        />
                      </label>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {method === "percentage" ? (
            <p className="text-sm font-semibold text-slate-600">
              已分配 {formatPercentage(percentageTotal)}% /{" "}
              {percentageDifference >= 0 ? "还差" : "超出"}{" "}
              {formatPercentage(Math.abs(percentageDifference))}%
            </p>
          ) : method === "amount" ? (
            <p className="text-sm font-semibold text-slate-600">
              已分配 {formatCents(assignedAmountCents)} / 总额 {formatCents(amountCents)} /{" "}
              {amountDifferenceCents >= 0 ? "还差" : "超出"}{" "}
              {formatCents(Math.abs(amountDifferenceCents))}
            </p>
          ) : null}

          <div className="border-t border-slate-100 pt-5">
            {allocationError ? (
              <p className="mb-3 font-semibold text-rose-600">份额不匹配：{allocationError}</p>
            ) : null}
            {submitError ? (
              <p className="mb-3 font-semibold text-rose-600" role="alert">
                {submitError}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full rounded-2xl bg-teal-600 px-5 py-3.5 font-bold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSubmitting ? "保存中…" : initialValue ? "保存修改" : "创建账单"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
