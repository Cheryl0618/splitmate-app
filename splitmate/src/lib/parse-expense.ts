import OpenAI from "openai";
import type {
  ResponseFormatTextJSONSchemaConfig,
  ResponseInput,
} from "openai/resources/responses/responses";

import { parseFailureFixture } from "./__fixtures__/parse-failure";
import { receiptFixture } from "./__fixtures__/receipt";
import { textExpenseFixture } from "./__fixtures__/text-expense";
import {
  expenseCategories,
  type ExpenseCategory,
} from "./expense-input";
import {
  LimitValidationError,
  validateAiTextLength,
} from "./limits";

export const OPENAI_MODEL = "gpt-5.6-terra";
const OPENAI_TIMEOUT_MS = 10_000;
let openAIClient: OpenAI | null = null;
let openAIClientApiKey: string | null = null;
let openAIClientFetch: typeof globalThis.fetch | null = null;

export interface Member {
  id: string;
  displayName: string;
  isCurrentUser?: boolean;
}

export interface ParsedExpenseItem {
  name: string;
  priceCents: number;
  memberIds: string[];
}

export type OriginalParseExpenseInput =
  | { type: "image"; data: string }
  | { type: "text"; data: string };

export interface ExpenseClarificationTurn {
  question: string;
  answer: string;
}

export interface DeterminedExpenseFields {
  merchantName?: string;
  category: ExpenseCategory;
  totalCents: number;
  taxCents?: number;
  tipCents?: number;
  items?: ParsedExpenseItem[];
  paidByMemberId?: string;
  participantMemberIds: string[];
  note?: string;
  unresolvedNames: string[];
  confidence: "high" | "low";
}

export interface ExpenseClarificationContext {
  originalInput: OriginalParseExpenseInput;
  determined: DeterminedExpenseFields;
  history: ExpenseClarificationTurn[];
  pendingQuestion: string;
}

export interface ParsedExpense extends DeterminedExpenseFields {
  needsClarification: boolean;
  clarificationQuestion?: string;
  clarificationContext?: ExpenseClarificationContext;
  clarificationExhausted?: boolean;
  validationError?: string;
  debugError?: string;
}

export type ParseExpenseInput =
  | OriginalParseExpenseInput
  | {
      type: "clarification";
      data: string;
      context: ExpenseClarificationContext;
    };

interface ModelExpenseItem {
  name: string;
  priceYuan: number;
  memberIds: string[];
}

interface ModelExpense {
  merchantName: string | null;
  category: ExpenseCategory;
  totalYuan: number | null;
  taxYuan: number | null;
  tipYuan: number | null;
  items: ModelExpenseItem[] | null;
  paidByMemberId: string | null;
  participantMemberIds: string[];
  note: string | null;
  unresolvedNames: string[];
  confidence: "high" | "low";
  needsClarification?: boolean;
  clarificationQuestion?: string | null;
}

const EXPENSE_RESPONSE_FORMAT = {
  type: "json_schema" as const,
  name: "parsed_expense",
  strict: true,
  description: "A shared expense extracted from either an image or text.",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      merchantName: {
        type: ["string", "null"],
        description: "Merchant or venue name, or null when it cannot be identified.",
      },
      category: {
        type: "string",
        enum: expenseCategories,
        description:
          "Choose exactly one category. 餐饮: meals, group dining, takeout, or restaurants. 咖啡: coffee, milk tea, or other drinks. 交通: taxi, Uber, subway, fuel, parking, or flights. 住宿: hotels, vacation rentals, or rent. 超市: supermarkets, groceries, Costco, or Whole Foods. 日用: toiletries, household supplies, or cleaning products. 娱乐: movies, games, admission tickets, or performances. 其他: use when none of the above clearly matches. If uncertain, return 其他 instead of guessing. For receipt images, infer from the merchant when reliable, such as Whole Foods → 超市 and Starbucks/星巴克 → 咖啡.",
      },
      totalYuan: {
        type: ["number", "null"],
        description: "Total expense amount in yuan, not cents; null when unresolved.",
      },
      taxYuan: {
        type: ["number", "null"],
        description: "Tax amount in yuan, not cents; null when absent or unresolved.",
      },
      tipYuan: {
        type: ["number", "null"],
        description: "Tip amount in yuan, not cents; null when absent or unresolved.",
      },
      items: {
        anyOf: [
          {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                name: { type: "string", description: "Recognized item name." },
                priceYuan: {
                  type: "number",
                  description: "Recognized item price in yuan, not cents.",
                },
                memberIds: {
                  type: "array",
                  items: { type: "string" },
                  description: "IDs of matched members who consumed this item.",
                },
              },
              required: ["name", "priceYuan", "memberIds"],
            },
          },
          { type: "null" },
        ],
        description: "Receipt line items, or null when the input has no itemization.",
      },
      paidByMemberId: {
        type: ["string", "null"],
        description: "Matched payer member ID, or null when unresolved.",
      },
      participantMemberIds: {
        type: "array",
        items: { type: "string" },
        description: "Matched member IDs participating in the expense.",
      },
      note: {
        type: ["string", "null"],
        description: "Concise editable note preserving relevant expense details.",
      },
      unresolvedNames: {
        type: "array",
        items: { type: "string" },
        description: "Names mentioned in the input that do not match any member.",
      },
      confidence: {
        type: "string",
        enum: ["high", "low"],
        description: "Low when any important expense field is uncertain.",
      },
      needsClarification: {
        type: "boolean",
        description:
          "True when total amount, payer, or participants still cannot be determined.",
      },
      clarificationQuestion: {
        type: ["string", "null"],
        description:
          "One concrete question for the single most important missing required field, or null when complete.",
      },
    },
    required: [
      "merchantName",
      "category",
      "totalYuan",
      "taxYuan",
      "tipYuan",
      "items",
      "paidByMemberId",
      "participantMemberIds",
      "note",
      "unresolvedNames",
      "confidence",
      "needsClarification",
      "clarificationQuestion",
    ],
  },
};

function failureResult(
  input: ParseExpenseInput,
  debugError?: string
): ParsedExpense {
  const originalInput =
    input.type === "clarification" ? input.context.originalInput : input;
  return {
    category: "其他",
    totalCents: 0,
    participantMemberIds: [],
    note: originalInput.type === "text" ? originalInput.data : undefined,
    unresolvedNames: [],
    confidence: "low",
    needsClarification: false,
    clarificationExhausted: true,
    ...(debugError ? { debugError } : {}),
  };
}

function initialDetermined(input: OriginalParseExpenseInput): DeterminedExpenseFields {
  return {
    category: "其他",
    totalCents: 0,
    participantMemberIds: [],
    note: input.type === "text" ? input.data : undefined,
    unresolvedNames: [],
    confidence: "low",
  };
}

function localClarificationResult(
  input: OriginalParseExpenseInput,
  question: string,
  validationError?: string
): ParsedExpense {
  const determined = initialDetermined(input);
  return {
    ...determined,
    needsClarification: !validationError,
    clarificationQuestion: validationError ? undefined : question,
    clarificationContext: validationError
      ? undefined
      : {
          originalInput: input,
          determined,
          history: [],
          pendingQuestion: question,
        },
    ...(validationError ? { validationError } : {}),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function errorDiagnostics(error: unknown) {
  const root = asRecord(error);
  const apiError = asRecord(root?.error);
  const rawStatus = root?.status;
  const statusCode =
    typeof rawStatus === "number" || typeof rawStatus === "string"
      ? rawStatus
      : undefined;
  const apiMessage =
    (typeof apiError?.message === "string" ? apiError.message : undefined) ??
    (typeof root?.message === "string" ? root.message : undefined) ??
    (error instanceof Error ? error.message : String(error));

  return {
    statusCode,
    apiMessage,
    debugError:
      statusCode === undefined
        ? apiMessage
        : `OpenAI API ${statusCode}: ${apiMessage}`,
  };
}

function yuanToCents(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  const cents = Math.round(value * 100);
  return Number.isSafeInteger(cents) ? cents : undefined;
}

function uniqueValidMemberIds(value: unknown, validMemberIds: Set<string>) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter(
        (memberId): memberId is string =>
          typeof memberId === "string" && validMemberIds.has(memberId)
      )
    ),
  ];
}

function uniqueStrings(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter(
        (item): item is string => typeof item === "string" && item.trim().length > 0
      )
    ),
  ];
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function normalizeModelExpense(
  value: unknown,
  input: ParseExpenseInput,
  members: Member[]
): ParsedExpense {
  if (!value || typeof value !== "object") return failureResult(input);
  const raw = value as Partial<ModelExpense>;
  const totalCents = yuanToCents(raw.totalYuan) ?? 0;

  const validMemberIds = new Set(members.map((member) => member.id));
  const items = Array.isArray(raw.items)
    ? raw.items.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const priceCents = yuanToCents(item.priceYuan);
        const name = optionalString(item.name);
        if (!name || priceCents === undefined) return [];
        return [
          {
            name,
            priceCents,
            memberIds: uniqueValidMemberIds(item.memberIds, validMemberIds),
          },
        ];
      })
    : undefined;
  const paidByMemberId =
    typeof raw.paidByMemberId === "string" && validMemberIds.has(raw.paidByMemberId)
      ? raw.paidByMemberId
      : undefined;
  const category = expenseCategories.includes(raw.category as ExpenseCategory)
    ? (raw.category as ExpenseCategory)
    : "其他";

  const current: DeterminedExpenseFields = {
    merchantName: optionalString(raw.merchantName),
    category,
    totalCents,
    taxCents: yuanToCents(raw.taxYuan),
    tipCents: yuanToCents(raw.tipYuan),
    items: items?.length ? items : undefined,
    paidByMemberId,
    participantMemberIds: uniqueValidMemberIds(
      raw.participantMemberIds,
      validMemberIds
    ),
    note: optionalString(raw.note),
    unresolvedNames: uniqueStrings(raw.unresolvedNames),
    confidence: raw.confidence === "high" ? "high" : "low",
  };
  const previous = input.type === "clarification" ? input.context.determined : null;
  const determined: DeterminedExpenseFields = previous
    ? {
        merchantName: current.merchantName ?? previous.merchantName,
        category:
          current.category === "其他" && previous.category !== "其他"
            ? previous.category
            : current.category,
        totalCents: current.totalCents > 0 ? current.totalCents : previous.totalCents,
        taxCents: current.taxCents ?? previous.taxCents,
        tipCents: current.tipCents ?? previous.tipCents,
        items: current.items?.length ? current.items : previous.items,
        paidByMemberId: current.paidByMemberId ?? previous.paidByMemberId,
        participantMemberIds: current.participantMemberIds.length
          ? current.participantMemberIds
          : previous.participantMemberIds,
        note: current.note ?? previous.note,
        unresolvedNames: current.unresolvedNames.length
          ? current.unresolvedNames
          : previous.unresolvedNames,
        confidence: current.confidence,
      }
    : current;
  const history =
    input.type === "clarification"
      ? [
          ...input.context.history,
          { question: input.context.pendingQuestion, answer: input.data.trim() },
        ]
      : [];
  const missingQuestion = requiredFieldQuestion(determined);
  if (!missingQuestion) return { ...determined, needsClarification: false };
  if (history.length >= 3) {
    return {
      ...determined,
      confidence: "low",
      needsClarification: false,
      clarificationExhausted: true,
    };
  }
  const originalInput =
    input.type === "clarification" ? input.context.originalInput : input;
  return {
    ...determined,
    needsClarification: true,
    clarificationQuestion: missingQuestion,
    clarificationContext: {
      originalInput,
      determined,
      history,
      pendingQuestion: missingQuestion,
    },
  };
}

function requiredFieldQuestion(fields: DeterminedExpenseFields) {
  if (fields.totalCents <= 0) return "这笔账的总金额是多少？";
  if (!fields.paidByMemberId) return "这笔账是谁付款的？";
  if (fields.participantMemberIds.length === 0) return "这笔账由哪些成员参与分摊？";
  return null;
}

function mockResult(input: ParseExpenseInput) {
  if (input.data.includes("mock-failure")) return parseFailureFixture;
  return input.type === "image" ? receiptFixture : textExpenseFixture;
}

function buildModelInput(input: ParseExpenseInput, members: Member[]) {
  const directory = members.map(({ id, displayName, isCurrentUser }) => ({
    id,
    displayName,
    isCurrentUser: Boolean(isCurrentUser),
  }));
  const instructions = [
    "Extract exactly one shared expense.",
    "All monetary output fields are yuan numbers, never cents.",
    "Only use IDs from the supplied member directory.",
    "Match first-person references such as 我 to the member marked isCurrentUser.",
    "Put every mentioned name that cannot be matched in unresolvedNames.",
    "Do not invent prices, people, receipt lines, tax, tip, or payer details.",
    "The required fields are totalYuan, paidByMemberId, and at least one participantMemberId. If any remains unknown, set needsClarification to true and ask exactly one concrete clarificationQuestion.",
    "For clarification turns, preserve every already determined field and use the accumulated answers to resolve only missing fields; do not restart extraction.",
    "Classify the expense using the category rules in the response schema. Use 其他 whenever the evidence is insufficient; never guess a more specific category.",
    "For receipt images, use a recognizable merchant when helpful: Whole Foods is 超市, Starbucks/星巴克 is 咖啡.",
    `Member directory: ${JSON.stringify(directory)}`,
  ].join(" ");

  const content =
    input.type === "clarification"
      ? [
          {
            type: "input_text" as const,
            text: [
              "Continue the existing expense extraction using this accumulated context.",
              `Original input: ${JSON.stringify(input.context.originalInput)}`,
              `Already determined fields: ${JSON.stringify({
                ...input.context.determined,
                totalYuan: input.context.determined.totalCents / 100,
                taxYuan:
                  input.context.determined.taxCents === undefined
                    ? null
                    : input.context.determined.taxCents / 100,
                tipYuan:
                  input.context.determined.tipCents === undefined
                    ? null
                    : input.context.determined.tipCents / 100,
                items: input.context.determined.items?.map((item) => ({
                  name: item.name,
                  priceYuan: item.priceCents / 100,
                  memberIds: item.memberIds,
                })),
                totalCents: undefined,
                taxCents: undefined,
                tipCents: undefined,
              })}`,
              `Previous completed Q&A: ${JSON.stringify(input.context.history)}`,
              `Latest question: ${input.context.pendingQuestion}`,
              `Latest answer: ${input.data}`,
            ].join("\n"),
          },
        ]
      : input.type === "image"
      ? [
          {
            type: "input_text" as const,
            text: "Parse this receipt image into the provided expense schema.",
          },
          {
            type: "input_image" as const,
            image_url: input.data,
            detail: "high" as const,
          },
        ]
      : [
          {
            type: "input_text" as const,
            text: `Parse this expense description into the provided expense schema:\n${input.data}`,
          },
        ];

  return [
    { role: "system" as const, content: instructions },
    { role: "user" as const, content },
  ];
}

export async function requestStructuredOutput(
  input: string | ResponseInput,
  format: ResponseFormatTextJSONSchemaConfig
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  if (
    !openAIClient ||
    openAIClientApiKey !== apiKey ||
    openAIClientFetch !== globalThis.fetch
  ) {
    openAIClient = new OpenAI({
      apiKey,
      timeout: OPENAI_TIMEOUT_MS,
      maxRetries: 0,
    });
    openAIClientApiKey = apiKey;
    openAIClientFetch = globalThis.fetch;
  }
  const response = await openAIClient.responses.create({
    model: OPENAI_MODEL,
    input,
    text: { format },
  });
  if (!response.output_text) throw new Error("AI response did not contain output");
  return JSON.parse(response.output_text) as unknown;
}

async function callModel(input: ParseExpenseInput, members: Member[]) {
  return requestStructuredOutput(buildModelInput(input, members), EXPENSE_RESPONSE_FORMAT);
}

export async function parseExpense(
  input: ParseExpenseInput,
  members: Member[]
): Promise<ParsedExpense> {
  if (input.type === "text") {
    try {
      validateAiTextLength(input.data);
    } catch (error) {
      if (error instanceof LimitValidationError) {
        console.log(`[parseExpense] local-block reason=input-limit length=${Array.from(input.data).length}`);
        return localClarificationResult(input, "", error.message);
      }
      throw error;
    }
    const trimmed = input.data.trim();
    const reasons = [
      ...(Array.from(trimmed).length < 5 ? ["too-short"] : []),
      ...(!/\d/.test(trimmed) ? ["missing-number"] : []),
    ];
    if (reasons.length > 0) {
      console.log(`[parseExpense] local-block reason=${reasons.join(",")}`);
      return localClarificationResult(input, "请补充金额等信息");
    }
  } else if (input.type === "clarification") {
    try {
      validateAiTextLength(input.data);
    } catch (error) {
      if (error instanceof LimitValidationError) {
        console.log(`[parseExpense] local-block reason=clarification-input-limit length=${Array.from(input.data).length}`);
        return {
          ...input.context.determined,
          needsClarification: true,
          clarificationQuestion: input.context.pendingQuestion,
          clarificationContext: input.context,
          validationError: error.message,
        };
      }
      throw error;
    }
  }
  const mockAiRawValue = process.env.MOCK_AI;
  const useMock = mockAiRawValue === "true";
  console.log(
    `[parseExpense] branch=${useMock ? "mock" : "real"} MOCK_AI=${JSON.stringify(mockAiRawValue)}`
  );

  if (useMock) {
    return normalizeModelExpense(mockResult(input), input, members);
  }

  try {
    return normalizeModelExpense(await callModel(input, members), input, members);
  } catch (error) {
    const diagnostics = errorDiagnostics(error);
    console.error("[parseExpense] real branch failed", {
      statusCode: diagnostics.statusCode,
      apiMessage: diagnostics.apiMessage,
      error,
    });
    return failureResult(
      input,
      process.env.NODE_ENV === "development"
        ? diagnostics.debugError
        : undefined
    );
  }
}
