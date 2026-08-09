import { describe, expect, it } from "vitest";

import { calculateShares, type SplitParticipant } from "./split";

const members: SplitParticipant[] = [
  { memberId: "A" },
  { memberId: "B" },
  { memberId: "C" },
];

describe("calculateShares", () => {
  it("splits 10000 cents equally across three members", () => {
    const shares = calculateShares(10_000, "equal", members);

    expect(Object.values(shares)).toEqual([3_334, 3_333, 3_333]);
    expect(Object.values(shares).reduce((total, share) => total + share, 0)).toBe(
      10_000
    );
  });

  it("assigns a single cent to the first of three equal members", () => {
    const shares = calculateShares(1, "equal", members);

    expect(Object.values(shares)).toEqual([1, 0, 0]);
    expect(Object.values(shares).reduce((total, share) => total + share, 0)).toBe(1);
  });

  it("splits 10000 cents using 40/30/30 percentages", () => {
    const shares = calculateShares(10_000, "percentage", [
      { memberId: "A", percentage: 40 },
      { memberId: "B", percentage: 30 },
      { memberId: "C", percentage: 30 },
    ]);

    expect(shares).toEqual({ A: 4_000, B: 3_000, C: 3_000 });
    expect(Object.values(shares).reduce((total, share) => total + share, 0)).toBe(
      10_000
    );
  });

  it("rejects amount shares that do not equal the total", () => {
    expect(() =>
      calculateShares(10_000, "amount", [
        { memberId: "A", amountCents: 4_000 },
        { memberId: "B", amountCents: 5_000 },
      ])
    ).toThrow("amount shares sum to 9000, expected 10000");
  });

  it("returns the same result across 100 identical calls", () => {
    const participants = [
      { memberId: "A", percentage: 33.33 },
      { memberId: "B", percentage: 33.33 },
      { memberId: "C", percentage: 33.34 },
    ];
    const expected = calculateShares(12_347, "percentage", participants);

    for (let run = 0; run < 100; run++) {
      expect(calculateShares(12_347, "percentage", participants)).toEqual(expected);
    }
  });
});
