import { beforeAll, describe, expect, it } from "vitest";

import { seedDatabase } from "../../prisma/seed";
import { getGroupBalances } from "./balances";

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
});
