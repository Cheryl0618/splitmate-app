export const DEFAULT_DEMO_USER_ID = "user-xiaoli";

export function normalizeDisplayName(value: unknown) {
  const displayName = typeof value === "string" ? value.trim() : "";
  const length = Array.from(displayName).length;
  if (length < 2 || length > 20) {
    throw new Error("名字需要 2 到 20 个字");
  }
  return displayName;
}
