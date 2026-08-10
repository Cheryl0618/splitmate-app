export function parseMemberNames(input: string) {
  const names = input
    .split(/[,，\n]/)
    .map((name) => name.trim())
    .filter(Boolean);
  return [...new Set(names)];
}
