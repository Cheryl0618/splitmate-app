import { parseFailureFixture } from "./__fixtures__/parse-failure";
import { receiptFixture } from "./__fixtures__/receipt";
import { textExpenseFixture } from "./__fixtures__/text-expense";

export interface Member {
  id: string;
  displayName: string;
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
  name?: unknown;
  priceYuan?: unknown;
  memberIds?: unknown;
}

interface ModelExpense {
  merchantName?: unknown;
  totalYuan?: unknown;
  taxYuan?: unknown;
  tipYuan?: unknown;
  items?: unknown;
  paidByMemberId?: unknown;
  participantMemberIds?: unknown;
  note?: unknown;
  unresolvedNames?: unknown;
  confidence?: unknown;
}

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

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function normalizeModelExpense(
  value: ModelExpense,
  input: ParseExpenseInput,
  members: Member[]
): ParsedExpense {
  const totalCents = yuanToCents(value.totalYuan);
  if (totalCents === undefined) return failureResult(input);

  const validMemberIds = new Set(members.map((member) => member.id));
  const participantMemberIds = stringArray(value.participantMemberIds).filter((id) =>
    validMemberIds.has(id)
  );
  const paidByMemberId =
    typeof value.paidByMemberId === "string" && validMemberIds.has(value.paidByMemberId)
      ? value.paidByMemberId
      : undefined;
  const items = Array.isArray(value.items)
    ? value.items.flatMap((rawItem) => {
        if (!rawItem || typeof rawItem !== "object") return [];
        const item = rawItem as ModelExpenseItem;
        const priceCents = yuanToCents(item.priceYuan);
        if (typeof item.name !== "string" || priceCents === undefined) return [];
        return [
          {
            name: item.name,
            priceCents,
            memberIds: stringArray(item.memberIds).filter((id) =>
              validMemberIds.has(id)
            ),
          },
        ];
      })
    : undefined;

  return {
    merchantName:
      typeof value.merchantName === "string" ? value.merchantName : undefined,
    totalCents,
    taxCents: yuanToCents(value.taxYuan),
    tipCents: yuanToCents(value.tipYuan),
    items: items?.length ? items : undefined,
    paidByMemberId,
    participantMemberIds: [...new Set(participantMemberIds)],
    note: typeof value.note === "string" ? value.note : undefined,
    unresolvedNames: [...new Set(stringArray(value.unresolvedNames))],
    confidence: value.confidence === "high" ? "high" : "low",
  };
}

function mockResult(input: ParseExpenseInput) {
  if (input.data.includes("mock-failure")) return parseFailureFixture;
  return input.type === "image" ? receiptFixture : textExpenseFixture;
}

function jsonFromModelContent(content: string): ModelExpense {
  const trimmed = content.trim();
  const unfenced = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
    : trimmed;
  const parsed: unknown = JSON.parse(unfenced);
  if (!parsed || typeof parsed !== "object") throw new Error("invalid AI response");
  return parsed as ModelExpense;
}

function modelMessages(input: ParseExpenseInput, members: Member[]) {
  const memberDirectory = members.map(({ id, displayName }) => ({ id, displayName }));
  const instruction = `Extract one shared expense. Return JSON only with this shape: {merchantName?: string, totalYuan: number, taxYuan?: number, tipYuan?: number, items?: [{name: string, priceYuan: number, memberIds: string[]}], paidByMemberId?: string, participantMemberIds: string[], note?: string, unresolvedNames: string[], confidence: "high"|"low"}. All money values must be yuan numbers. Match people only against this member directory: ${JSON.stringify(memberDirectory)}. Put mentioned names that cannot be matched into unresolvedNames. Do not invent item prices or split details.`;

  if (input.type === "image") {
    return [
      { role: "system", content: instruction },
      {
        role: "user",
        content: [
          { type: "text", text: "Parse this receipt image." },
          { type: "image_url", image_url: { url: input.data } },
        ],
      },
    ];
  }

  return [
    { role: "system", content: instruction },
    { role: "user", content: `Parse this expense description:\n${input.data}` },
  ];
}

async function callModel(input: ParseExpenseInput, members: Member[]) {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) throw new Error("AI_API_KEY is not configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(
      process.env.AI_API_URL ?? "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.AI_MODEL ?? "gpt-4.1-mini",
          messages: modelMessages(input, members),
          response_format: { type: "json_object" },
          temperature: 0,
        }),
        signal: controller.signal,
      }
    );
    if (!response.ok) throw new Error(`AI request failed: ${response.status}`);
    const body: unknown = await response.json();
    const content =
      body &&
      typeof body === "object" &&
      Array.isArray((body as { choices?: unknown }).choices) &&
      typeof (body as { choices: Array<{ message?: { content?: unknown } }> }).choices[0]
        ?.message?.content === "string"
        ? (body as { choices: Array<{ message: { content: string } }> }).choices[0].message
            .content
        : null;
    if (!content) throw new Error("AI response did not contain JSON");
    return jsonFromModelContent(content);
  } finally {
    clearTimeout(timeout);
  }
}

export async function parseExpense(
  input: ParseExpenseInput,
  members: Member[]
): Promise<ParsedExpense> {
  try {
    const modelResult =
      process.env.MOCK_AI === "true"
        ? mockResult(input)
        : await callModel(input, members);
    return normalizeModelExpense(modelResult, input, members);
  } catch {
    return failureResult(input);
  }
}
