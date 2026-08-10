import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { calculateItemizedShares } from "./itemized-shares";
import {
  parseExpense,
  type Member,
  type ParsedExpense,
} from "./parse-expense";

const members: Member[] = [
  { id: "member-home-xiaoli", displayName: "小李" },
  { id: "member-home-xiaowang", displayName: "小王" },
  { id: "member-home-lucy", displayName: "Lucy" },
  { id: "member-home-tom", displayName: "Tom" },
  { id: "member-home-emma", displayName: "Emma" },
];

function expectParsedShape(result: ParsedExpense) {
  expect(["餐饮", "咖啡", "交通", "住宿", "超市", "日用", "娱乐", "其他"]).toContain(
    result.category
  );
  expect(Number.isInteger(result.totalCents)).toBe(true);
  expect(Array.isArray(result.participantMemberIds)).toBe(true);
  expect(Array.isArray(result.unresolvedNames)).toBe(true);
  expect(["high", "low"]).toContain(result.confidence);
  if (result.taxCents !== undefined) expect(Number.isInteger(result.taxCents)).toBe(true);
  if (result.tipCents !== undefined) expect(Number.isInteger(result.tipCents)).toBe(true);
  for (const item of result.items ?? []) {
    expect(typeof item.name).toBe("string");
    expect(Number.isInteger(item.priceCents)).toBe(true);
    expect(Array.isArray(item.memberIds)).toBe(true);
  }
}

describe("parseExpense in mock mode", () => {
  beforeEach(() => {
    vi.stubEnv("MOCK_AI", "true");
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("network forbidden"))));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns all three fixtures in the ParsedExpense shape without network calls", async () => {
    const receipt = await parseExpense(
      { type: "image", data: "data:image/png;base64,receipt" },
      members
    );
    const text = await parseExpense(
      {
        type: "text",
        data: "今晚聚餐我付了238，小王没喝酒，Lucy吃了龙虾，Tom只喝咖啡",
      },
      members
    );
    const failure = await parseExpense(
      { type: "text", data: "mock-failure" },
      members
    );

    for (const result of [receipt, text, failure]) expectParsedShape(result);
    expect(receipt.items).toHaveLength(5);
    expect(text.totalCents).toBe(23_800);
    expect(failure.confidence).toBe("low");
    expect([receipt.category, text.category, failure.category]).toEqual([
      "超市",
      "餐饮",
      "其他",
    ]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("converts every fixture money field to integer cents", async () => {
    const results = await Promise.all([
      parseExpense({ type: "image", data: "data:image/jpeg;base64,receipt" }, members),
      parseExpense({ type: "text", data: "今晚聚餐我付了238" }, members),
      parseExpense({ type: "text", data: "mock-failure" }, members),
    ]);

    expect(results[0].totalCents).toBe(12_000);
    expect(results[0].taxCents).toBe(800);
    expect(results[0].tipCents).toBe(0);
    for (const result of results) {
      expect(Number.isInteger(result.totalCents)).toBe(true);
      if (result.taxCents !== undefined) expect(Number.isInteger(result.taxCents)).toBe(true);
      if (result.tipCents !== undefined) expect(Number.isInteger(result.tipCents)).toBe(true);
      expect(result.items?.every((item) => Number.isInteger(item.priceCents)) ?? true).toBe(
        true
      );
    }
  });

  it("returns a low-confidence shell instead of throwing for the failure fixture", async () => {
    await expect(
      parseExpense({ type: "image", data: "mock-failure" }, members)
    ).resolves.toEqual({
      category: "其他",
      totalCents: 0,
      participantMemberIds: [],
      unresolvedNames: [],
      confidence: "low",
    });
  });

  it("allocates all tax cents proportionally without losing a cent", async () => {
    const receipt = await parseExpense(
      { type: "image", data: "data:image/png;base64,receipt" },
      members
    );
    const allocation = calculateItemizedShares(
      receipt.totalCents,
      receipt.taxCents ?? 0,
      receipt.tipCents ?? 0,
      receipt.items ?? []
    );

    expect(Object.values(allocation.taxShares).reduce((sum, cents) => sum + cents, 0)).toBe(
      receipt.taxCents
    );
    expect(Object.values(allocation.shares).reduce((sum, cents) => sum + cents, 0)).toBe(
      receipt.totalCents
    );
  });
});

describe("parseExpense mode selection", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('treats the string "false" as real mode instead of returning a fixture', async () => {
    vi.stubEnv("MOCK_AI", "false");
    vi.stubEnv("OPENAI_API_KEY", "");
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const input = { type: "text" as const, data: "昨天打车45，我和Lucy平摊" };

    const result = await parseExpense(input, members);

    expect(result).toEqual({
      category: "其他",
      totalCents: 0,
      participantMemberIds: [],
      note: input.data,
      unresolvedNames: [],
      confidence: "low",
    });
    expect(result.totalCents).not.toBe(23_800);
    expect(log).toHaveBeenCalledWith(
      '[parseExpense] branch=real MOCK_AI="false"'
    );
  });

  it("logs the mock branch and raw environment value", async () => {
    vi.stubEnv("MOCK_AI", "true");
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await parseExpense({ type: "text", data: "fixture" }, members);

    expect(log).toHaveBeenCalledWith(
      '[parseExpense] branch=mock MOCK_AI="true"'
    );
  });

  it("returns API status and message as debugError in development", async () => {
    vi.stubEnv("MOCK_AI", "false");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            error: {
              message: "The requested model is unavailable",
              type: "invalid_request_error",
              code: "model_not_found",
            },
          }),
          {
            status: 404,
            headers: {
              "content-type": "application/json",
              "x-request-id": "request-test",
            },
          }
        )
      )
    );
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const errorLog = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const result = await parseExpense(
      { type: "text", data: "昨天打车45，我和Lucy平摊" },
      members
    );

    expect(result.debugError).toBe(
      "OpenAI API 404: The requested model is unavailable"
    );
    expect(errorLog).toHaveBeenCalledWith(
      "[parseExpense] real branch failed",
      expect.objectContaining({
        statusCode: 404,
        apiMessage: "The requested model is unavailable",
        error: expect.anything(),
      })
    );
  });

  it("does not expose debugError outside development", async () => {
    vi.stubEnv("MOCK_AI", "false");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await parseExpense(
      { type: "text", data: "昨天打车45，我和Lucy平摊" },
      members
    );

    expect(result).not.toHaveProperty("debugError");
  });

  it.each([
    ["昨天打车45，我和Lucy平摊", "交通", 45],
    ["买菜花了120", "超市", 120],
    ["Tom请我们喝咖啡86", "咖啡", 86],
  ] as const)(
    "preserves the model category for %s",
    async (input, category, totalYuan) => {
      vi.stubEnv("MOCK_AI", "false");
      vi.stubEnv("OPENAI_API_KEY", "test-key");
      const fetchMock = vi.fn(
        async (_request: string | URL | Request, _init?: RequestInit) =>
          new Response(
            JSON.stringify({
              output_text: JSON.stringify({
                merchantName: null,
                category,
                totalYuan,
                taxYuan: null,
                tipYuan: null,
                items: null,
                paidByMemberId: null,
                participantMemberIds: [],
                note: input,
                unresolvedNames: [],
                confidence: "high",
              }),
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            }
          )
      );
      vi.stubGlobal("fetch", fetchMock);
      vi.spyOn(console, "log").mockImplementation(() => undefined);

      const result = await parseExpense({ type: "text", data: input }, members);
      const [request, init] = fetchMock.mock.calls[0];
      const requestBody = JSON.parse(
        request instanceof Request
          ? await request.clone().text()
          : String(init?.body ?? "{}")
      ) as {
        input: unknown;
        text: { format: { schema: { properties: { category: { enum: string[] } } } } };
      };

      expect(result.category).toBe(category);
      expect(result.totalCents).toBe(totalYuan * 100);
      expect(requestBody.text.format.schema.properties.category.enum).toEqual([
        "餐饮",
        "咖啡",
        "交通",
        "住宿",
        "超市",
        "日用",
        "娱乐",
        "其他",
      ]);
      expect(JSON.stringify(requestBody.input)).toContain(input);
    }
  );

  it("falls back to 其他 when a model category is invalid", async () => {
    vi.stubEnv("MOCK_AI", "false");
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            output_text: JSON.stringify({
              merchantName: null,
              category: "无法判断",
              totalYuan: 10,
              taxYuan: null,
              tipYuan: null,
              items: null,
              paidByMemberId: null,
              participantMemberIds: [],
              note: null,
              unresolvedNames: [],
              confidence: "low",
            }),
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    );
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const result = await parseExpense(
      { type: "text", data: "一笔说不清的消费" },
      members
    );

    expect(result.category).toBe("其他");
  });
});
