export function validatePartialRepayment(
  amountCents: number,
  suggestedAmountCents: number
) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error("还款金额必须大于 0 且精确到分");
  }
  if (!Number.isInteger(suggestedAmountCents) || suggestedAmountCents <= 0) {
    throw new Error("系统建议金额无效，请刷新后重试");
  }
  if (amountCents > suggestedAmountCents) {
    throw new Error("还款金额不能超过系统建议金额");
  }
}
