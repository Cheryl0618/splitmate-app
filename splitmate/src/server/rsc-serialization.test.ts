import { beforeAll, describe, expect, it } from "vitest";

import { seedDatabase } from "../../prisma/seed";
import { getExpenseDetail, getExpenseFormGroup } from "./expenses";
import { getGroupDetail } from "./group-details";
import { getGroupListData } from "./groups";
import { getRelationshipPageData } from "./relationships";
import { getSettlementPageData } from "./settlements";

function expectPlainSerializable(value: unknown, path = "props"): void {
  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return;
  }

  expect(value, `${path} must not contain Date instances`).not.toBeInstanceOf(Date);
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      expectPlainSerializable(item, `${path}[${index}]`)
    );
    return;
  }

  expect(typeof value, `${path} must be a plain object`).toBe("object");
  expect(
    Object.getPrototypeOf(value),
    `${path} must use Object.prototype`
  ).toBe(Object.prototype);
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    expectPlainSerializable(child, `${path}.${key}`);
  }
}

describe("Server Component data serialization", () => {
  beforeAll(() => {
    seedDatabase();
  });

  it("passes only computed display data to the relationship client", () => {
    const data = getRelationshipPageData(
      "group-home",
      "member-home-xiaowang",
      "user-xiaoli"
    );

    expect(data?.state).toBe("ready");
    expect(data).not.toHaveProperty("expenses");
    expect(data).not.toHaveProperty("settlements");
    expectPlainSerializable(data);
  });

  it("keeps the other page payloads RSC-serializable", () => {
    const payloads = {
      home: getGroupListData(),
      groupDetail: getGroupDetail("group-home"),
      expenseDetail: getExpenseDetail("home-rent-01"),
      expenseForm: getExpenseFormGroup("group-home"),
      settlement: getSettlementPageData("group-home"),
    };

    expectPlainSerializable(payloads);
  });
});
