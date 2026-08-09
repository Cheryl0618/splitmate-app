"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useCurrentUser } from "@/lib/current-user";
import type { ExpenseInput } from "@/lib/expense-input";
import { formatCents } from "@/lib/format";
import { calculateItemizedShares } from "@/lib/itemized-shares";
import type {
  ParsedExpense,
  ParseExpenseInput,
} from "@/lib/parse-expense";
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

interface EditableExpenseItem {
  id: string;
  name: string;
  priceInput: string;
  memberIds: string[];
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

function centsInputValue(amountCents: number | undefined) {
  return ((amountCents ?? 0) / 100).toFixed(2);
}

function readImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("无法读取图片"));
    reader.onerror = () => reject(new Error("无法读取图片"));
    reader.readAsDataURL(file);
  });
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
  const [textInput, setTextInput] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState<ParsedExpense | null>(null);
  const [parseNotice, setParseNotice] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [itemRows, setItemRows] = useState<EditableExpenseItem[] | null>(null);
  const [taxInput, setTaxInput] = useState("0.00");
  const [tipInput, setTipInput] = useState("0.00");
  const [unresolvedMappings, setUnresolvedMappings] = useState<
    Record<string, string>
  >({});

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

  const manualParticipants: SplitParticipant[] = selectedMembers.map((member) => ({
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

  const taxCents = parseYuanInput(taxInput).amountCents;
  const tipCents = parseYuanInput(tipInput).amountCents;
  const itemizedResult = (() => {
    if (!itemRows) return null;
    try {
      return calculateItemizedShares(
        amountCents,
        taxCents,
        tipCents,
        itemRows.map((item) => ({
          priceCents: parseYuanInput(item.priceInput).amountCents,
          memberIds: item.memberIds,
        }))
      );
    } catch {
      return null;
    }
  })();
  const participants: SplitParticipant[] = itemRows
    ? Object.entries(itemizedResult?.shares ?? {}).map(
        ([memberId, amountCents]) => ({ memberId, amountCents })
      )
    : manualParticipants;

  const calculatedShares = (() => {
    if (amountCents < 0 || participants.length === 0) return null;
    try {
      return calculateShares(
        amountCents,
        itemRows ? "amount" : method,
        participants
      );
    } catch {
      return null;
    }
  })();

  const percentageDifference = 100 - percentageTotal;
  const amountDifferenceCents = amountCents - assignedAmountCents;
  const allocationError = itemRows
    ? itemizedResult === null
      ? "请为每件商品至少选择一名参与人"
      : ""
    : method === "percentage" && Math.abs(percentageDifference) > 1e-9
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

  const recognizedDifferenceCents = itemizedResult
    ? amountCents - itemizedResult.recognizedTotalCents
    : 0;

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

  function applyParsedExpense(result: ParsedExpense, input: ParseExpenseInput) {
    const memberIds = new Set(group.members.map((member) => member.id));
    const parsedParticipants = result.participantMemberIds.filter((memberId) =>
      memberIds.has(memberId)
    );
    const parsedDescription = [result.merchantName, result.note]
      .filter((value): value is string => Boolean(value?.trim()))
      .join(" · ");

    setParseResult(result);
    setUnresolvedMappings({});
    if (result.totalCents > 0) {
      setAmountCents(result.totalCents);
      setAmountInput(centsInputValue(result.totalCents));
    }
    if (parsedDescription) {
      setDescription(parsedDescription);
    } else if (input.type === "text") {
      setDescription(input.data);
    }
    if (result.paidByMemberId && memberIds.has(result.paidByMemberId)) {
      setPaidBy(result.paidByMemberId);
    }
    if (parsedParticipants.length > 0) {
      setSelectedMemberIds(parsedParticipants);
      setPercentageInputs(equalPercentages(parsedParticipants));
    }
    if (result.items?.length) {
      setItemRows(
        result.items.map((item, index) => ({
          id: `parsed-item-${index}`,
          name: item.name,
          priceInput: centsInputValue(item.priceCents),
          memberIds: item.memberIds.filter((memberId) => memberIds.has(memberId)),
        }))
      );
      setTaxInput(centsInputValue(result.taxCents));
      setTipInput(centsInputValue(result.tipCents));
      setMethod("amount");
    } else {
      setItemRows(null);
      setMethod("equal");
    }
    setParseNotice(
      result.confidence === "low"
        ? "识别失败或结果不完整，已降级到手动录入。"
        : "解析完成，请核对后再创建账单。"
    );
  }

  async function requestParse(input: ParseExpenseInput) {
    setIsParsing(true);
    setParseNotice("正在识别并匹配群组成员…");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(`/api/groups/${group.id}/parse-expense`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-demo-user-id": currentUserId,
        },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("解析失败");
      const result = (await response.json()) as ParsedExpense;
      applyParsedExpense(result, input);
    } catch {
      applyParsedExpense(
        {
          totalCents: 0,
          participantMemberIds: [],
          note: input.type === "text" ? input.data : undefined,
          unresolvedNames: [],
          confidence: "low",
        },
        input
      );
    } finally {
      window.clearTimeout(timeout);
      setIsParsing(false);
    }
  }

  async function handleImageFile(file: File | undefined) {
    if (!file) return;
    try {
      const data = await readImage(file);
      setPhotoUrls([data]);
      await requestParse({ type: "image", data });
    } catch {
      setParseResult({
        totalCents: 0,
        participantMemberIds: [],
        unresolvedNames: [],
        confidence: "low",
      });
      setParseNotice("图片读取失败，已降级到手动录入。");
    }
  }

  function toggleItemMember(itemId: string, memberId: string) {
    setItemRows((current) =>
      current?.map((item) =>
        item.id !== itemId
          ? item
          : {
              ...item,
              memberIds: item.memberIds.includes(memberId)
                ? item.memberIds.filter((id) => id !== memberId)
                : [...item.memberIds, memberId],
            }
      ) ?? null
    );
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
      method: itemRows ? "amount" : method,
      participants,
      photoUrls: initialValue ? undefined : photoUrls,
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

        {!initialValue ? (
          <section className="mb-6 rounded-3xl border border-teal-200 bg-white p-5 shadow-[0_12px_35px_rgba(15,118,110,0.08)] sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-teal-700">AI 快速录入</p>
                <p className="mt-1 text-sm text-slate-500">
                  拍一张收据，或用一句话描述这笔支出。
                </p>
              </div>
              <label
                className={`cursor-pointer rounded-2xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white ${
                  isParsing ? "pointer-events-none opacity-50" : "hover:bg-teal-700"
                }`}
              >
                拍照 / 选收据
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  disabled={isParsing}
                  onChange={(event) => void handleImageFile(event.target.files?.[0])}
                  className="sr-only"
                />
              </label>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <textarea
                value={textInput}
                onChange={(event) => setTextInput(event.target.value)}
                placeholder="例如：今晚聚餐我付了238，小王没喝酒，Lucy吃了龙虾…"
                rows={2}
                className="min-h-20 flex-1 resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
              <button
                type="button"
                disabled={isParsing || !textInput.trim()}
                onClick={() =>
                  void requestParse({ type: "text", data: textInput.trim() })
                }
                className="rounded-2xl border border-teal-200 px-5 py-3 text-sm font-bold text-teal-700 hover:bg-teal-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300 sm:self-stretch"
              >
                解析这句话
              </button>
            </div>

            {parseNotice ? (
              <div
                className={`mt-4 rounded-2xl px-4 py-3 text-sm font-semibold ${
                  isParsing
                    ? "bg-teal-50 text-teal-800"
                    : parseResult?.confidence === "low"
                      ? "bg-amber-50 text-amber-800"
                      : "bg-emerald-50 text-emerald-800"
                }`}
                role="status"
              >
                {isParsing ? (
                  <span className="mr-2 inline-block h-3 w-3 animate-pulse rounded-full bg-teal-500" />
                ) : null}
                {parseNotice}
              </div>
            ) : null}

            {photoUrls[0] ? (
              <div className="mt-4">
                <p className="mb-2 text-xs font-bold text-slate-500">已保留的收据原图</p>
                <Image
                  src={photoUrls[0]}
                  alt="待保存的收据原图"
                  width={720}
                  height={480}
                  unoptimized
                  className="max-h-56 w-full rounded-2xl border border-slate-200 object-contain"
                />
              </div>
            ) : null}
          </section>
        ) : null}

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_50px_rgba(15,23,42,0.06)] sm:p-8"
        >
          {parseResult?.confidence === "low" ? (
            <p
              className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 font-semibold text-amber-900"
              role="alert"
            >
              识别结果可能不准，请核对
            </p>
          ) : null}

          {parseResult?.unresolvedNames.length ? (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <h2 className="font-bold text-amber-900">这些名字没有匹配到成员</h2>
              <div className="mt-3 space-y-3">
                {parseResult.unresolvedNames.map((name) => (
                  <label
                    key={name}
                    className="grid gap-2 text-sm font-semibold text-amber-900 sm:grid-cols-[1fr_1.5fr] sm:items-center"
                  >
                    <span>{name}</span>
                    <select
                      value={unresolvedMappings[name] ?? ""}
                      onChange={(event) => {
                        const memberId = event.target.value;
                        setUnresolvedMappings((current) => ({
                          ...current,
                          [name]: memberId,
                        }));
                        if (memberId) {
                          setSelectedMemberIds((current) =>
                            current.includes(memberId) ? current : [...current, memberId]
                          );
                        }
                      }}
                      className="rounded-xl border border-amber-200 bg-white px-3 py-2 outline-none focus:border-amber-500"
                    >
                      <option value="">请选择对应成员</option>
                      {group.members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.displayName}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </section>
          ) : null}
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

          {itemRows ? (
            <section className="space-y-5" aria-labelledby="receipt-items-heading">
              <div>
                <h2 id="receipt-items-heading" className="text-sm font-bold text-slate-700">
                  收据商品与参与人
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  每一项都会在勾选的成员之间均分。
                </p>
              </div>

              <div className="space-y-4">
                {itemRows.map((item, index) => (
                  <article
                    key={item.id}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
                      <label className="text-xs font-bold text-slate-500">
                        商品名称
                        <input
                          value={item.name}
                          onChange={(event) =>
                            setItemRows((current) =>
                              current?.map((row) =>
                                row.id === item.id
                                  ? { ...row, name: event.target.value }
                                  : row
                              ) ?? null
                            )
                          }
                          aria-label={`第 ${index + 1} 项商品名称`}
                          className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-teal-500"
                        />
                      </label>
                      <label className="text-xs font-bold text-slate-500">
                        单价（元）
                        <span className="mt-1.5 flex rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus-within:border-teal-500">
                          <span className="text-slate-400">¥</span>
                          <input
                            inputMode="decimal"
                            value={item.priceInput}
                            onChange={(event) => {
                              const parsed = parseYuanInput(event.target.value);
                              setItemRows((current) =>
                                current?.map((row) =>
                                  row.id === item.id
                                    ? { ...row, priceInput: parsed.value }
                                    : row
                                ) ?? null
                              );
                            }}
                            aria-label={`${item.name}的单价`}
                            className="ml-1 min-w-0 flex-1 text-right text-sm font-semibold outline-none"
                          />
                        </span>
                      </label>
                    </div>
                    <fieldset className="mt-3">
                      <legend className="text-xs font-bold text-slate-500">分摊这项的人</legend>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {group.members.map((member) => {
                          const checked = item.memberIds.includes(member.id);
                          return (
                            <label
                              key={member.id}
                              className={`cursor-pointer rounded-xl border px-3 py-2 text-xs font-bold ${
                                checked
                                  ? "border-teal-300 bg-teal-50 text-teal-800"
                                  : "border-slate-200 text-slate-500"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleItemMember(item.id, member.id)}
                                className="sr-only"
                              />
                              {member.displayName}
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  </article>
                ))}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {([
                  ["税费（元）", taxInput, setTaxInput],
                  ["小费（元）", tipInput, setTipInput],
                ] as const).map(([label, value, setter]) => (
                  <label key={label} className="text-sm font-bold text-slate-700">
                    {label}
                    <span className="mt-2 flex rounded-2xl border border-slate-200 px-4 py-3 focus-within:border-teal-500">
                      <span className="text-slate-400">¥</span>
                      <input
                        inputMode="decimal"
                        value={value}
                        onChange={(event) => setter(parseYuanInput(event.target.value).value)}
                        className="ml-1 min-w-0 flex-1 text-right font-semibold outline-none"
                      />
                    </span>
                  </label>
                ))}
              </div>

              {itemizedResult ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <p className="font-semibold">
                    商品、税费与小费合计 {formatCents(itemizedResult.recognizedTotalCents)}；
                    税费和小费已按每人商品小计比例分摊。
                  </p>
                  {recognizedDifferenceCents !== 0 ? (
                    <p className="mt-2 font-bold text-amber-700" role="status">
                      与识别总额{recognizedDifferenceCents > 0 ? "还差" : "超出"}{" "}
                      {formatCents(Math.abs(recognizedDifferenceCents))}，请核对；不阻断提交。
                    </p>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : (
            <>
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
                  已分配 {formatCents(assignedAmountCents)} / 总额{" "}
                  {formatCents(amountCents)} /{" "}
                  {amountDifferenceCents >= 0 ? "还差" : "超出"}{" "}
                  {formatCents(Math.abs(amountDifferenceCents))}
                </p>
              ) : null}
            </>
          )}

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
