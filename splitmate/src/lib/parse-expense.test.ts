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
    expect(fetch).not.toHaveBeenCalled();
  });

  it("converts every model money field to integer cents", async () => {
    const receipt = await parseExpense(
      { type: "image", data: "data:image/jpeg;base64,receipt" },
      members
    );

    expect(receipt.totalCents).toBe(12_000);
    expect(receipt.taxCents).toBe(800);
    expect(receipt.tipCents).toBe(0);
    expect(receipt.items?.every((item) => Number.isInteger(item.priceCents))).toBe(
      true
    );
  });

  it("returns a low-confidence shell instead of throwing for the failure fixture", async () => {
    await expect(
      parseExpense({ type: "image", data: "mock-failure" }, members)
    ).resolves.toEqual({
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
