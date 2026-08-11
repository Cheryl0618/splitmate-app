import { describe, expect, it } from "vitest";

import {
  avatarColorClass,
  avatarColorOptions,
  DEFAULT_AVATAR_COLOR,
  normalizeAvatarColor,
} from "./avatar-colors";

describe("avatar colors", () => {
  it("provides exactly six selectable colors", () => {
    expect(avatarColorOptions).toHaveLength(6);
  });

  it("falls back to the default for an unknown color", () => {
    expect(normalizeAvatarColor("unknown")).toBe(DEFAULT_AVATAR_COLOR);
    expect(avatarColorClass("unknown")).toBe(avatarColorOptions[0].avatarClass);
  });
});
