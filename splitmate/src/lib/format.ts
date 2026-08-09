export function formatCents(amountCents: number) {
  const sign = amountCents < 0 ? "-" : "";
  return `${sign}¥${(Math.abs(amountCents) / 100).toFixed(2)}`;
}
