export const supportedCurrencies = [
  "CNY",
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "CAD",
  "AUD",
  "HKD",
  "SGD",
  "KRW",
  "TWD",
] as const;

export type Currency = (typeof supportedCurrencies)[number];

export const currencyLabels: Record<Currency, string> = {
  CNY: "人民币（CNY）",
  USD: "美元（USD）",
  EUR: "欧元（EUR）",
  GBP: "英镑（GBP）",
  JPY: "日元（JPY）",
  CAD: "加拿大元（CAD）",
  AUD: "澳大利亚元（AUD）",
  HKD: "港币（HKD）",
  SGD: "新加坡元（SGD）",
  KRW: "韩元（KRW）",
  TWD: "新台币（TWD）",
};
