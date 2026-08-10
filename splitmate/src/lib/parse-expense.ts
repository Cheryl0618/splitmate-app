import OpenAI from "openai";

import { parseFailureFixture } from "./__fixtures__/parse-failure";
import { receiptFixture } from "./__fixtures__/receipt";
import { textExpenseFixture } from "./__fixtures__/text-expense";

const OPENAI_MODEL = "gpt-5.6-terra";
const OPENAI_TIMEOUT_MS = 10_000;

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

function failureResult(input: ParseExpenseInput): ParsedExpense {
  return {
    totalCents: 0,
    participantMemberIds: [],
    note: input.type === "text" ? input.data : undefined,
    unresolvedNames: [],
    confidence: "low",
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

  return {
    merchantName: optionalString(raw.merchantName),
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

async function callModel(input: ParseExpenseInput, members: Member[]) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const client = new OpenAI({
    apiKey,
    timeout: OPENAI_TIMEOUT_MS,
    maxRetries: 0,
  });
  const response = await client.responses.create({
    model: OPENAI_MODEL,
    input: buildModelInput(input, members),
    text: { format: EXPENSE_RESPONSE_FORMAT },
  });
  if (!response.output_text) throw new Error("AI response did not contain output");
  return JSON.parse(response.output_text) as unknown;
}

export async function parseExpense(
  input: ParseExpenseInput,
  members: Member[]
): Promise<ParsedExpense> {
  if (process.env.MOCK_AI === "true") {
    return normalizeModelExpense(mockResult(input), input, members);
  }

  try {
    return normalizeModelExpense(await callModel(input, members), input, members);
  } catch {
    return failureResult(input);
  }
}
