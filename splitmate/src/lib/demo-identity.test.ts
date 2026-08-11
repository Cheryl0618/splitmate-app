import { describe, expect, it } from "vitest";

import { normalizeDisplayName } from "./demo-identity";

describe("demo identity", () => {
  it("trims and accepts names from 2 to 20 characters", () => {
    expect(normalizeDisplayName("  小李  ")).toBe("小李");
    expect(normalizeDisplayName("A".repeat(20))).toBe("A".repeat(20));
  });

  it("rejects names outside the allowed range", () => {
    expect(() => normalizeDisplayName("李")).toThrow("2 到 20");
    expect(() => normalizeDisplayName("A".repeat(21))).toThrow("2 到 20");
  });
});
