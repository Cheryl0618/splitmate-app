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

export interface ParsedExpense {
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
  debugError?: string;
}

export type ParseExpenseInput =
  | { type: "image"; data: string }
  | { type: "text"; data: string };

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
    ],
  },
};

function failureResult(
  input: ParseExpenseInput,
  debugError?: string
): ParsedExpense {
  return {
    category: "其他",
    totalCents: 0,
    participantMemberIds: [],
    note: input.type === "text" ? input.data : undefined,
    unresolvedNames: [],
    confidence: "low",
    ...(debugError ? { debugError } : {}),
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
  const totalCents = yuanToCents(raw.totalYuan);
  if (totalCents === undefined) return failureResult(input);

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

  return {
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
    "Classify the expense using the category rules in the response schema. Use 其他 whenever the evidence is insufficient; never guess a more specific category.",
    "For receipt images, use a recognizable merchant when helpful: Whole Foods is 超市, Starbucks/星巴克 is 咖啡.",
    `Member directory: ${JSON.stringify(directory)}`,
  ].join(" ");

  const content =
    input.type === "image"
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
