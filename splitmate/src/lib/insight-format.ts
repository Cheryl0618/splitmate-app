import type { Insight } from "./consumption-summary";
import type { Currency } from "./currency";
import { formatCents } from "./format";
import type { Locale } from "@/i18n/context";

const AMOUNT_PLACEHOLDER = /\{amount(?:([1-9]\d*))?\}/g;
const CURRENCY_MARK = /[\u0024\u00a3\u00a5\u20a9\u20ac]/;

export function formatInsightText(insight: Insight, currency: Currency, locale?: Locale) {
  const amounts = insight.relatedCents ?? [];
  if (CURRENCY_MARK.test(insight.text)) return null;
  const placeholders = [...insight.text.matchAll(AMOUNT_PLACEHOLDER)];

  if (placeholders.length === 0) {
    return insight.text.includes("{amount") ||
      amounts.length > 0
      ? null
      : insight.text;
  }
  if (placeholders.length !== amounts.length) return null;

  if (placeholders.length === 1) {
    if (placeholders[0][0] !== "{amount}") return null;
  } else if (
    placeholders.some((placeholder, index) => placeholder[0] !== `{amount${index + 1}}`)
  ) {
    return null;
  }

  let text = insight.text;
  placeholders.forEach((placeholder, index) => {
    text = text.replace(placeholder[0], formatCents(amounts[index], currency, locale));
  });
  return text.includes("{amount") ? null : text;
}
