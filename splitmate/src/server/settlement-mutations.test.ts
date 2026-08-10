import { beforeEach, describe, expect, it } from "vitest";

import { seedDatabase } from "../../prisma/seed";
import { createSettlement, deleteSettlement } from "./settlement-mutations";
import { getSettlementPageData } from "./settlements";

describe("partial repayments", () => {
  beforeEach(() => seedDatabase());

  it("reduces both balances by the partial amount and rejects overpayment", () => {
    const before = getSettlementPageData("group-home");
    const suggestion = before?.optimalTransfers[0];
    expect(before).not.toBeNull();
    expect(suggestion).toBeDefined();
    if (!before || !suggestion) return;

    const partialCents = Math.floor(suggestion.amountCents / 2);
    const created = createSettlement("group-home", "user-xiaoli", {
      fromMemberId: suggestion.from,
      toMemberId: suggestion.to,
      amountCents: partialCents,
      suggestedAmountCents: suggestion.amountCents,
    });
    const after = getSettlementPageData("group-home");
    expect(after?.balances[suggestion.from]).toBe(
      before.balances[suggestion.from] + partialCents
    );
    expect(after?.balances[suggestion.to]).toBe(
      before.balances[suggestion.to] - partialCents
    );
    const remainingSuggestion = after?.optimalTransfers.find(
      (transfer) =>
        transfer.from === suggestion.from && transfer.to === suggestion.to
    );
    expect(remainingSuggestion?.amountCents).toBe(
      suggestion.amountCents - partialCents
    );

    expect(() =>
      createSettlement("group-home", "user-xiaoli", {
        fromMemberId: suggestion.from,
        toMemberId: suggestion.to,
        amountCents: suggestion.amountCents + 1,
        suggestedAmountCents: suggestion.amountCents,
      })
    ).toThrow("还款金额不能超过系统建议金额");

    deleteSettlement("group-home", created.settlementId, "user-xiaoli");
    expect(getSettlementPageData("group-home")?.balances).toEqual(before.balances);
  });
});
