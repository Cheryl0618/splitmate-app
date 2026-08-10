import { describe, expect, it } from "vitest";

import {
  MAX_AI_INPUT_LENGTH,
  MAX_AMOUNT_CENTS,
  MAX_DESCRIPTION_LENGTH,
  MAX_EXPENSES_PER_GROUP,
  MAX_MEMBERS_PER_GROUP,
  validateAiTextLength,
  validateExpenseCount,
  validateExpenseLimits,
  validateMemberCount,
} from "./limits";

describe("product limits", () => {
  it("rejects every configured limit when exceeded", () => {
    expect(() => validateMemberCount(MAX_MEMBERS_PER_GROUP + 1)).toThrow(
      "每个群组最多支持 50 位成员"
    );
    expect(() => validateExpenseCount(MAX_EXPENSES_PER_GROUP)).toThrow(
      "每个群组最多记录 2000 笔账单"
    );
    expect(() =>
      validateExpenseLimits({
        amountCents: MAX_AMOUNT_CENTS + 1,
        description: "测试",
      })
    ).toThrow("单笔账单金额不能超过一百万元");
    expect(() =>
      validateExpenseLimits({
        amountCents: 100,
        description: "账".repeat(MAX_DESCRIPTION_LENGTH + 1),
      })
    ).toThrow("账单标题不能超过 200 个字符");
    expect(() => validateAiTextLength("字".repeat(MAX_AI_INPUT_LENGTH + 1))).toThrow(
      "AI 输入不能超过 500 个字符"
    );
  });
});
