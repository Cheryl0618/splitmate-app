"use client";

import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Chip } from "@/components/ui/chip";
import { useCurrentUser } from "@/lib/current-user";
import {
  expenseCategories,
  type ExpenseCategory,
  type ExpenseInput,
} from "@/lib/expense-input";
import { formatCents } from "@/lib/format";
import type { Currency } from "@/lib/currency";
import {
  MAX_AI_INPUT_LENGTH,
  MAX_AMOUNT_CENTS,
  MAX_DESCRIPTION_LENGTH,
} from "@/lib/limits";
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
import { useT } from "@/i18n/context";
import { categoryKey } from "@/i18n/category";

export interface ExpenseFormInitialValue {
  id: string;
  amountCents: number;
  description: string;
  date: string;
  paidBy: string;
  category: ExpenseCategory;
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

function currencyPrefix(currency: Currency, locale: "zh" | "en") {
  return formatCents(0, currency, locale).replace(/[\d.,\s]/g, "");
}

function readImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Could not read image"));
    reader.onerror = () => reject(new Error("Could not read image"));
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
  const { locale, t } = useT();
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
  const [category, setCategory] = useState<ExpenseCategory>(
    initialValue?.category ?? expenseCategories[7]
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
  const [clarificationAnswer, setClarificationAnswer] = useState("");
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
      ? t("expense.itemParticipantError")
      : ""
    : method === "percentage" && Math.abs(percentageDifference) > 1e-9
      ? percentageDifference > 0
        ? t("expense.shortBy", { amount: `${formatPercentage(percentageDifference)}%` })
        : t("expense.overBy", { amount: `${formatPercentage(Math.abs(percentageDifference))}%` })
      : method === "amount" && amountDifferenceCents !== 0
        ? amountDifferenceCents > 0
          ? t("expense.shortBy", { amount: formatCents(amountDifferenceCents, group.currency, locale) })
          : t("expense.overBy", { amount: formatCents(Math.abs(amountDifferenceCents), group.currency, locale) })
        : "";
  const amountLimitError =
    amountCents > MAX_AMOUNT_CENTS ? t("expense.amountLimit") : "";
  const descriptionLimitError =
    Array.from(description).length > MAX_DESCRIPTION_LENGTH
      ? t("expense.titleLimit", { count: MAX_DESCRIPTION_LENGTH })
      : "";
  const aiInputLimitError =
    Array.from(textInput).length > MAX_AI_INPUT_LENGTH
      ? t("expense.aiLimit", { count: MAX_AI_INPUT_LENGTH })
      : "";
  const canSubmit =
    amountCents > 0 &&
    description.trim().length > 0 &&
    Boolean(date) &&
    Boolean(paidBy) &&
    participants.length > 0 &&
    calculatedShares !== null &&
    !allocationError &&
    !amountLimitError &&
    !descriptionLimitError &&
    !parseResult?.needsClarification &&
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
    setCategory(result.category);
    setUnresolvedMappings({});
    if (result.totalCents > 0) {
      setAmountCents(result.totalCents);
      setAmountInput(centsInputValue(result.totalCents));
    }
    if (parsedDescription) {
      setDescription(parsedDescription);
    } else {
      const originalInput =
        input.type === "clarification" ? input.context.originalInput : input;
      if (originalInput.type === "text") setDescription(originalInput.data);
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
      result.validationError
        ? result.validationError
        : result.needsClarification
          ? t("expense.clarificationNeeded")
          : result.clarificationExhausted
            ? t("expense.clarificationExhausted")
            : result.confidence === "low"
        ? t("expense.parseFallback")
        : t("expense.parseComplete")
    );
    setClarificationAnswer("");
  }

  async function requestParse(input: ParseExpenseInput) {
    setIsParsing(true);
    setParseNotice(t("expense.parsing"));
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(`/api/groups/${group.id}/parse-expense`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-demo-user-id": currentUserId,
          "x-ui-locale": locale,
        },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(t("expense.parseError"));
      const result = (await response.json()) as ParsedExpense;
      applyParsedExpense(result, input);
    } catch {
      applyParsedExpense(
        {
          category: expenseCategories[7],
          totalCents: 0,
          participantMemberIds: [],
          note: input.type === "text" ? input.data : undefined,
          unresolvedNames: [],
          confidence: "low",
          needsClarification: false,
          clarificationExhausted: true,
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
    setIsParsing(true);
    setParseNotice(t("expense.readingReceipt"));
    try {
      const data = await readImage(file);
      setPhotoUrls([data]);
      await requestParse({ type: "image", data });
    } catch {
      setParseResult({
        category: expenseCategories[7],
        totalCents: 0,
        participantMemberIds: [],
        unresolvedNames: [],
        confidence: "low",
        needsClarification: false,
        clarificationExhausted: true,
      });
      setParseNotice(t("expense.imageFallback"));
      setIsParsing(false);
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
      category,
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
          "x-ui-locale": locale,
        },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: string; expenseId?: string };
      if (!response.ok) throw new Error(result.error || t("expense.saveError"));

      router.push(initialValue ? `/expenses/${initialValue.id}` : `/groups/${group.id}`);
      router.refresh();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t("expense.saveError"));
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-bg text-ink">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 lg:px-12">
        <Link
          href={initialValue ? `/expenses/${initialValue.id}` : `/groups/${group.id}`}
          className="text-sm font-semibold text-ink hover:opacity-70"
        >
          {t("group.cancelBack")}
        </Link>

        <div className="pb-7 pt-10">
          <p className="text-sm font-semibold text-ink">{group.name}</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
            {t(initialValue ? "nav.expenseEdit" : "nav.expenseNew")}
          </h1>
        </div>

        {!initialValue ? (
          <section className="mb-6 rounded-[14px] bg-surface p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-ink">{t("expense.aiQuickEntry")}</p>
                <p className="mt-1 text-sm text-ink-soft">
                  {t("expense.aiQuickDescription")}
                </p>
              </div>
              <label
                className={`cursor-pointer rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-surface ${
                  isParsing ? "pointer-events-none opacity-50" : "hover:opacity-85"
                }`}
              >
                {t("expense.photoReceipt")}
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
                placeholder={t("expense.aiPlaceholder")}
                rows={2}
                className="min-h-20 flex-1 resize-none rounded-[14px] border border-line px-4 py-3 text-sm outline-none focus:border-line focus:ring-2 focus:ring-ink"
              />
              <button
                type="button"
                disabled={isParsing || !textInput.trim() || Boolean(aiInputLimitError)}
                onClick={() =>
                  void requestParse({ type: "text", data: textInput.trim() })
                }
                className="rounded-full bg-surface px-5 py-3 text-sm font-bold text-ink hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-50 sm:self-stretch"
              >
                {t("expense.parseText")}
              </button>
            </div>

            {aiInputLimitError ? (
              <p className="mt-2 text-sm font-semibold text-ink" role="alert">
                {aiInputLimitError}
              </p>
            ) : null}

            {parseNotice ? (
              <div
                className={`mt-4 rounded-[14px] px-4 py-3 text-sm font-semibold ${
                  isParsing
                    ? "bg-inset text-ink"
                    : parseResult?.confidence === "low"
                      ? "bg-inset text-ink"
                      : "bg-inset text-ink"
                }`}
                role="status"
              >
                {isParsing ? (
                  <span className="mr-2 inline-block h-3 w-3 animate-pulse rounded-full bg-accent" />
                ) : null}
                {parseNotice}
              </div>
            ) : null}

            {parseResult?.needsClarification &&
            parseResult.clarificationQuestion &&
            parseResult.clarificationContext ? (
              <div className="mt-4 rounded-[14px] bg-inset p-4">
                <p className="font-bold text-ink">
                  {parseResult.clarificationQuestion}
                </p>
                <p className="mt-1 text-xs font-medium text-ink">
                  {t("expense.clarificationRound", { round: parseResult.clarificationContext.history.length + 1 })}
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={clarificationAnswer}
                    onChange={(event) => setClarificationAnswer(event.target.value)}
                    placeholder={t("expense.clarificationPlaceholder")}
                    className="min-w-0 flex-1 rounded-[14px] border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-line"
                  />
                  <button
                    type="button"
                    disabled={
                      isParsing ||
                      !clarificationAnswer.trim() ||
                      Array.from(clarificationAnswer).length > MAX_AI_INPUT_LENGTH
                    }
                    onClick={() =>
                      void requestParse({
                        type: "clarification",
                        data: clarificationAnswer.trim(),
                        context: parseResult.clarificationContext!,
                      })
                    }
                    className="rounded-full bg-accent px-4 py-3 text-sm font-bold text-surface hover:opacity-85 disabled:cursor-not-allowed disabled:bg-inset"
                  >
                    {t("expense.submitAnswer")}
                  </button>
                </div>
                {Array.from(clarificationAnswer).length > MAX_AI_INPUT_LENGTH ? (
                  <p className="mt-2 text-sm font-semibold text-ink" role="alert">
                    {t("expense.answerLimit", { count: MAX_AI_INPUT_LENGTH })}
                  </p>
                ) : null}
              </div>
            ) : null}

            {photoUrls[0] ? (
              <div className="mt-4">
                <p className="mb-2 text-xs font-bold text-ink-soft">{t("expense.receiptRetained")}</p>
                <Image
                  src={photoUrls[0]}
                  alt={t("expense.receiptAlt")}
                  width={720}
                  height={480}
                  unoptimized
                  className="max-h-56 w-full rounded-[14px] border border-line object-contain"
                />
              </div>
            ) : null}
          </section>
        ) : null}

        <form
          onSubmit={handleSubmit}
          className="min-w-0 space-y-6 rounded-[14px] bg-surface p-5 sm:p-8"
        >
          {parseResult?.confidence === "low" && !parseResult.needsClarification ? (
            <p
              className="rounded-[14px] bg-inset px-4 py-3 font-semibold text-ink"
              role="alert"
            >
              {t("expense.lowConfidence")}
            </p>
          ) : null}

          {parseResult?.debugError ? (
            <div
              className="rounded-[14px] bg-inset px-4 py-3 text-sm text-ink"
              role="status"
            >
              <p className="font-bold">{t("expense.debugInfo")}</p>
              <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs leading-5">
                {parseResult.debugError}
              </pre>
            </div>
          ) : null}

          {parseResult?.unresolvedNames.length ? (
            <section className="rounded-[14px] bg-inset p-4">
              <h2 className="font-bold text-ink">{t("expense.unresolvedNames")}</h2>
              <div className="mt-3 space-y-3">
                {parseResult.unresolvedNames.map((name) => (
                  <label
                    key={name}
                    className="grid gap-2 text-sm font-semibold text-ink sm:grid-cols-[1fr_1.5fr] sm:items-center"
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
                      className="rounded-[14px] border border-line bg-surface px-3 py-2 outline-none focus:border-line"
                    >
                      <option value="">{t("expense.chooseMember")}</option>
                      {group.members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.userId === currentUserId ? t("common.you") : member.displayName}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </section>
          ) : null}

          <div>
            <label htmlFor="description" className="text-sm font-bold text-ink">
              {t("expense.title")}
            </label>
            <input
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t("expense.titlePlaceholder")}
              className="mt-2 w-full rounded-[14px] border border-line px-4 py-3 outline-none focus:border-line focus:ring-2 focus:ring-ink"
            />
            {descriptionLimitError ? (
              <p className="mt-2 text-sm font-semibold text-ink" role="alert">
                {descriptionLimitError}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="amount" className="text-sm font-bold text-ink">
              {t("expense.amountCurrency", { currency: group.currency })}
            </label>
            <div className="mt-2 flex items-center rounded-[14px] border border-line px-4 focus-within:border-line focus-within:ring-2 focus-within:ring-ink">
              <span className="text-xl font-bold text-ink-soft">{currencyPrefix(group.currency, locale)}</span>
              <input
                id="amount"
                inputMode="decimal"
                placeholder="0.00"
                value={amountInput}
                onChange={(event) => {
                  const parsed = parseYuanInput(event.target.value);
                  setAmountInput(parsed.value);
                  setAmountCents(parsed.amountCents);
                  setAmountNotice(parsed.truncated ? t("expense.amountTruncated") : "");
                }}
                className="min-w-0 flex-1 bg-transparent px-3 py-4 text-2xl font-bold outline-none"
              />
            </div>
            {amountNotice ? (
              <p className="mt-2 text-sm font-medium text-ink">{amountNotice}</p>
            ) : null}
            {amountLimitError ? (
              <p className="mt-2 text-sm font-semibold text-ink" role="alert">
                {amountLimitError}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="date" className="text-sm font-bold text-ink">
              {t("expense.date")}
            </label>
            <input
              id="date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="mt-2 w-full rounded-[14px] border border-line px-4 py-3 outline-none focus:border-line focus:ring-2 focus:ring-ink"
            />
          </div>

          <div>
            <label htmlFor="category" className="text-sm font-bold text-ink">
              {t("expense.category")}
            </label>
            <select
              id="category"
              value={category}
              onChange={(event) => setCategory(event.target.value as ExpenseCategory)}
              className="mt-2 w-full rounded-[14px] border border-line bg-surface px-4 py-3 outline-none focus:border-line focus:ring-2 focus:ring-ink"
            >
              {expenseCategories.map((option) => (
                <option key={option} value={option}>
                  {t(categoryKey(option))}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="payer" className="text-sm font-bold text-ink">
              {t("expense.payer")}
            </label>
            <select
              id="payer"
              value={paidBy}
              onChange={(event) => setPaidBy(event.target.value)}
              className="mt-2 w-full rounded-[14px] border border-line bg-surface px-4 py-3 outline-none focus:border-line focus:ring-2 focus:ring-ink"
            >
              {group.members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.userId === currentUserId ? t("common.you") : member.displayName}
                </option>
              ))}
            </select>
          </div>

          {itemRows ? (
            <section className="space-y-5" aria-labelledby="receipt-items-heading">
              <div>
                <h2 id="receipt-items-heading" className="text-sm font-bold text-ink">
                  {t("expense.receiptItems")}
                </h2>
                <p className="mt-1 text-xs text-ink-soft">
                  {t("expense.receiptItemsDescription")}
                </p>
              </div>

              <div className="space-y-4">
                {itemRows.map((item, index) => (
                  <article
                    key={item.id}
                    className="rounded-[14px] bg-inset p-4"
                  >
                    <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
                      <label className="text-xs font-bold text-ink-soft">
                        {t("expense.itemName")}
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
                          aria-label={t("expense.itemNameLabel", { index: index + 1 })}
                          className="mt-1.5 w-full rounded-[14px] border border-line px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-line"
                        />
                      </label>
                      <label className="text-xs font-bold text-ink-soft">
                        {t("expense.unitPrice", { currency: group.currency })}
                        <span className="mt-1.5 flex rounded-[14px] border border-line px-3 py-2 text-ink focus-within:border-line">
                          <span className="text-ink-soft">{currencyPrefix(group.currency, locale)}</span>
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
                            aria-label={t("expense.itemPriceLabel", { name: item.name })}
                            className="ml-1 min-w-0 flex-1 text-right text-sm font-semibold outline-none"
                          />
                        </span>
                      </label>
                    </div>
                    <fieldset className="mt-3">
                      <legend className="text-xs font-bold text-ink-soft">{t("expense.itemParticipants")}</legend>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {group.members.map((member) => {
                          const checked = item.memberIds.includes(member.id);
                          return (
                            <Chip
                              key={member.id}
                              pressed={checked}
                              onClick={() => toggleItemMember(item.id, member.id)}
                            >
                              {member.userId === currentUserId ? t("common.you") : member.displayName}
                            </Chip>
                          );
                        })}
                      </div>
                    </fieldset>
                  </article>
                ))}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {([
                  [t("expense.tax", { currency: group.currency }), taxInput, setTaxInput],
                  [t("expense.tip", { currency: group.currency }), tipInput, setTipInput],
                ] as const).map(([label, value, setter]) => (
                  <label key={label} className="text-sm font-bold text-ink">
                    {label}
                    <span className="mt-2 flex rounded-[14px] border border-line px-4 py-3 focus-within:border-line">
                      <span className="text-ink-soft">{currencyPrefix(group.currency, locale)}</span>
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
                <div className="rounded-[14px] bg-inset px-4 py-3 text-sm text-ink-soft">
                  <p className="font-semibold">
                    {t("expense.itemizedTotal", { amount: formatCents(itemizedResult.recognizedTotalCents, group.currency, locale) })}
                  </p>
                  {recognizedDifferenceCents !== 0 ? (
                    <p className="mt-2 font-bold text-ink" role="status">
                      {t(recognizedDifferenceCents > 0 ? "expense.recognizedShort" : "expense.recognizedOver", {
                        amount: formatCents(Math.abs(recognizedDifferenceCents), group.currency, locale),
                      })}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : (
            <>
              <fieldset>
                <legend className="text-sm font-bold text-ink">{t("expense.participants")}</legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {group.members.map((member) => {
                    const selected = selectedMemberIds.includes(member.id);
                    return (
                      <label
                        key={member.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-[14px] border px-4 py-3 ${
                          selected
                            ? "border-line bg-inset"
                            : "border-line bg-surface"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleMember(member.id)}
                          className="h-4 w-4 accent-ink"
                        />
                        <span className="font-semibold">
                          {member.userId === currentUserId ? t("common.you") : member.displayName}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-sm font-bold text-ink">{t("expense.splitMethod")}</legend>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(
                    [
                      ["equal", t("expense.splitEqual")],
                      ["percentage", t("expense.splitPercentage")],
                      ["amount", t("expense.splitAmount")],
                    ] as const
                  ).map(([value, label]) => (
                    <Chip
                      key={value}
                      pressed={method === value}
                      onClick={() => changeMethod(value)}
                    >
                      {label}
                    </Chip>
                  ))}
                </div>
              </fieldset>

              <div className="overflow-hidden rounded-[14px] bg-inset">
                {selectedMembers.length === 0 ? (
                  <p className="px-4 py-5 text-center text-sm font-semibold text-ink">
                    {t("expense.selectParticipant")}
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
                        className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-line px-3 py-3 last:border-b-0 sm:gap-4 sm:px-4"
                      >
                        <span className="font-semibold">
                          {member.userId === currentUserId ? t("common.you") : member.displayName}
                        </span>
                        {method === "equal" ? (
                          <span className="amount text-lg font-medium">{formatCents(previewCents, group.currency, locale)}</span>
                        ) : method === "percentage" ? (
                          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                            <label className="flex items-center rounded-[14px] border border-line px-3 py-2">
                              <input
                                inputMode="decimal"
                                aria-label={t("expense.memberPercentage", { name: member.userId === currentUserId ? t("common.you") : member.displayName })}
                                value={percentageInputs[member.id] ?? ""}
                                onChange={(event) =>
                                  setPercentageInputs((current) => ({
                                    ...current,
                                    [member.id]: event.target.value.replace(/[^\d.]/g, ""),
                                  }))
                                }
                                className="w-12 bg-transparent text-right font-semibold outline-none sm:w-16"
                              />
                              <span className="ml-1 text-ink-soft">%</span>
                            </label>
                            <span className="amount w-18 text-right text-base font-medium text-ink sm:w-20">
                              {formatCents(previewCents, group.currency, locale)}
                            </span>
                          </div>
                        ) : (
                          <label className="flex items-center rounded-[14px] border border-line px-3 py-2">
                            <span className="text-ink-soft">{currencyPrefix(group.currency, locale)}</span>
                            <input
                              inputMode="decimal"
                              aria-label={t("expense.memberAmount", { name: member.userId === currentUserId ? t("common.you") : member.displayName })}
                              value={amountInputs[member.id] ?? ""}
                              onChange={(event) => {
                                const parsed = parseYuanInput(event.target.value);
                                setAmountInputs((current) => ({
                                  ...current,
                                  [member.id]: parsed.value,
                                }));
                              }}
                              className="amount ml-1 w-20 bg-transparent text-right text-lg font-medium outline-none sm:w-24"
                            />
                          </label>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {method === "percentage" ? (
                <p className="text-sm font-semibold text-ink-soft">
                  {t("expense.percentageProgress", {
                    assigned: formatPercentage(percentageTotal),
                    status: t(percentageDifference >= 0 ? "expense.short" : "expense.over"),
                    difference: formatPercentage(Math.abs(percentageDifference)),
                  })}
                </p>
              ) : method === "amount" ? (
                <p className="text-sm font-semibold text-ink-soft">
                  {t("expense.amountProgress", {
                    assigned: formatCents(assignedAmountCents, group.currency, locale),
                    total: formatCents(amountCents, group.currency, locale),
                    status: t(amountDifferenceCents >= 0 ? "expense.short" : "expense.over"),
                    difference: formatCents(Math.abs(amountDifferenceCents), group.currency, locale),
                  })}
                </p>
              ) : null}
            </>
          )}

          <div className="border-t border-line pt-5">
            {allocationError ? (
              <p className="mb-3 font-semibold text-ink">{t("expense.shareMismatch", { error: allocationError })}</p>
            ) : null}
            {submitError ? (
              <p className="mb-3 font-semibold text-ink" role="alert">
                {submitError}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3.5 font-bold text-surface transition-colors hover:opacity-85 disabled:cursor-not-allowed disabled:bg-inset"
            >
              {!initialValue ? <Plus aria-hidden="true" size={18} strokeWidth={2} /> : null}
              {t(isSubmitting ? "common.saving" : initialValue ? "expense.saveChanges" : "expense.create")}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
