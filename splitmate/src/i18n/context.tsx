"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import en from "./en.json";
import zh from "./zh.json";

export type Locale = "zh" | "en";
type Variables = Record<string, string | number>;

const STORAGE_KEY = "quits-language";
const dictionaries = { zh, en } as const;

function translate(locale: Locale, key: string, variables?: Variables) {
  const dictionary = dictionaries[locale] as Record<string, string>;
  const fallback = zh as Record<string, string>;
  let value = dictionary[key] ?? fallback[key] ?? key;
  for (const [name, replacement] of Object.entries(variables ?? {})) {
    value = value.replaceAll(`{${name}}`, String(replacement));
  }
  return value;
}

interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, variables?: Variables) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("zh");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const initial = stored === "zh" || stored === "en"
      ? stored
      : window.navigator.language.toLowerCase().startsWith("zh")
        ? "zh"
        : "en";
    setLocaleState(initial);
    document.documentElement.lang = initial === "zh" ? "zh-CN" : "en";
  }, []);

  const value = useMemo<I18nValue>(() => ({
    locale,
    setLocale(next) {
      window.localStorage.setItem(STORAGE_KEY, next);
      document.documentElement.lang = next === "zh" ? "zh-CN" : "en";
      setLocaleState(next);
    },
    t: (key, variables) => translate(locale, key, variables),
  }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useT must be used within I18nProvider");
  return value;
}
