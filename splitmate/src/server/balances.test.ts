import { beforeAll, describe, expect, it } from "vitest";

import { seedDatabase } from "../../prisma/seed";
import { getGroupBalances } from "./balances";
import { getSettlementPageData } from "./settlements";

describe("getGroupBalances", () => {
  beforeAll(() => {
    seedDatabase();
  });

  it("returns the exact balances for the home group", () => {
    const balancesByName = Object.fromEntries(
      getGroupBalances("group-home").map((member) => [
        member.displayName,
        member.amountCents,
      ])
    );

    expect(balancesByName).toEqual({
      小李: 10_000,
      小王: -6_000,
      Lucy: -4_000,
      Tom: 6_000,
      Emma: -6_000,
    });
  });

  it("applies confirmed settlements to the Hawaii group balances", () => {
    const balancesByName = Object.fromEntries(
      getGroupBalances("group-hawaii").map((member) => [
        member.displayName,
        member.amountCents,
      ])
    );

    expect(balancesByName).toEqual({
      小李: 0,
      小王: 0,
      Lucy: -8_000,
      Tom: 8_000,
      Emma: 0,
    });
  });

  it("builds a smaller simplified plan with traceable non-direct transfers", () => {
    const data = getSettlementPageData("group-home");

    expect(data?.directTransfers).toHaveLength(6);
    expect(data?.optimalTransfers).toHaveLength(3);
    const nonDirectTransfer = data?.optimalTransfers.find(
      (transfer) => !transfer.explanation.hasDirectDebt
    );
    expect(nonDirectTransfer).toBeDefined();
    expect(nonDirectTransfer?.explanation.debtorItems.length).toBeGreaterThan(0);
    expect(nonDirectTransfer?.explanation.creditorItems.length).toBeGreaterThan(0);
  });
});
