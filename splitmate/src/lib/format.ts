import type { Currency } from "./currency";
import type { Locale } from "@/i18n/context";

export function intlLocale(locale: Locale) {
  return locale === "zh" ? "zh-CN" : "en-US";
}

export function formatCents(
  amountCents: number,
  currency: Currency,
  locale?: Locale
) {
  const sign = amountCents < 0 ? "−" : "";
  const amount = new Intl.NumberFormat(intlLocale(locale ?? "en"), {
    style: "currency",
    currency,
    currencyDisplay: "symbol",
  }).format(Math.abs(amountCents) / 100);
  const legacyCompatibleAmount = locale === undefined && currency === "CNY"
    ? amount.replace("CN¥", "¥")
    : amount;
  return `${sign}${legacyCompatibleAmount}`;
}

export function formatDate(
  value: Date | string | number,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: locale === "zh" ? "long" : "short",
    day: "numeric",
  }
) {
  return new Intl.DateTimeFormat(intlLocale(locale), options).format(new Date(value));
}
