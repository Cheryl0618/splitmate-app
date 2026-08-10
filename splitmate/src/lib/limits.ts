export const MAX_MEMBERS_PER_GROUP = 50;
export const MAX_EXPENSES_PER_GROUP = 2_000;
export const MAX_AMOUNT_CENTS = 100_000_000;
export const MAX_DESCRIPTION_LENGTH = 200;
export const MAX_AI_INPUT_LENGTH = 500;

export class LimitValidationError extends Error {}

export function validateMemberCount(memberCount: number) {
  if (!Number.isInteger(memberCount) || memberCount < 0) {
    throw new LimitValidationError("群组成员数量无效");
  }
  if (memberCount > MAX_MEMBERS_PER_GROUP) {
    throw new LimitValidationError(
      `每个群组最多支持 ${MAX_MEMBERS_PER_GROUP} 位成员`
    );
  }
}

export function validateExpenseLimits(input: {
  amountCents: number;
  description: string;
}) {
  if (input.amountCents > MAX_AMOUNT_CENTS) {
    throw new LimitValidationError("单笔账单金额不能超过一百万元");
  }
  if (Array.from(input.description).length > MAX_DESCRIPTION_LENGTH) {
    throw new LimitValidationError(
      `账单标题不能超过 ${MAX_DESCRIPTION_LENGTH} 个字符`
    );
  }
}

export function validateExpenseCount(expenseCount: number) {
  if (expenseCount >= MAX_EXPENSES_PER_GROUP) {
    throw new LimitValidationError(
      `每个群组最多记录 ${MAX_EXPENSES_PER_GROUP} 笔账单`
    );
  }
}

export function validateAiTextLength(input: string) {
  if (Array.from(input).length > MAX_AI_INPUT_LENGTH) {
    throw new LimitValidationError(
      `AI 输入不能超过 ${MAX_AI_INPUT_LENGTH} 个字符`
    );
  }
}
