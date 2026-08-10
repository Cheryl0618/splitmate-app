import type { Currency } from "./currency";

const currencyDisplay: Record<
  Currency,
  { symbol: string; fractionDigits: number }
> = {
  CNY: { symbol: "¥", fractionDigits: 2 },
  USD: { symbol: "$", fractionDigits: 2 },
  EUR: { symbol: "€", fractionDigits: 2 },
  GBP: { symbol: "£", fractionDigits: 2 },
  JPY: { symbol: "¥", fractionDigits: 0 },
  CAD: { symbol: "CA$", fractionDigits: 2 },
  AUD: { symbol: "A$", fractionDigits: 2 },
  HKD: { symbol: "HK$", fractionDigits: 2 },
  SGD: { symbol: "S$", fractionDigits: 2 },
  KRW: { symbol: "₩", fractionDigits: 0 },
  TWD: { symbol: "NT$", fractionDigits: 2 },
};

export function formatCents(amountCents: number, currency: Currency = "CNY") {
  const sign = amountCents < 0 ? "-" : "";
  const display = currencyDisplay[currency];
  const amount = (Math.abs(amountCents) / 100).toLocaleString("en-US", {
    minimumFractionDigits: display.fractionDigits,
    maximumFractionDigits: display.fractionDigits,
  });
  return `${sign}${display.symbol}${amount}`;
}
