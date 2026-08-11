"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { IconButton } from "@/components/ui/icon-action";
import { useCurrentUser } from "@/lib/current-user";
import type { Insight, InsightKind } from "@/lib/consumption-summary";
import type { Currency } from "@/lib/currency";
import { formatInsightText } from "@/lib/insight-format";
import { useT } from "@/i18n/context";

const KIND_STYLES: Record<InsightKind, string> = {
  fact: "bg-accent-mid",
  trend: "bg-accent-light",
};

function isInsight(value: unknown): value is Insight {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.text === "string" &&
    ["fact", "trend"].includes(String(item.kind)) &&
    (item.relatedCents === undefined ||
      (Array.isArray(item.relatedCents) &&
        item.relatedCents.every((cents) => Number.isSafeInteger(cents))))
  );
}

function LoadingCard({ label }: { label: string }) {
  return (
    <section
      aria-label={label}
      aria-busy="true"
      className="min-h-44 animate-pulse rounded-[14px] bg-surface p-5 sm:p-6"
    >
      <div className="h-5 w-28 rounded bg-inset" />
      <div className="mt-5 space-y-3">
        <div className="h-11 rounded-[14px] bg-inset" />
        <div className="h-11 rounded-[14px] bg-inset" />
      </div>
    </section>
  );
}

export function ConsumptionSummaryPanel({
  endpoint,
  currency,
}: {
  endpoint: string;
  currency: Currency;
}) {
  const { currentUserId } = useCurrentUser();
  const { locale, t } = useT();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(
    async (force: boolean, signal?: AbortSignal) => {
      setLoading(true);
      setFailed(false);
      try {
        const response = await fetch(endpoint, {
          method: force ? "POST" : "GET",
          headers: { "x-demo-user-id": currentUserId, "x-ui-locale": locale },
          signal,
        });
        if (!response.ok) throw new Error(`Insight request failed: ${response.status}`);
        const body: unknown = await response.json();
        const raw =
          body && typeof body === "object"
            ? (body as { insights?: unknown }).insights
            : undefined;
        const nextInsights = Array.isArray(raw) ? raw.filter(isInsight).slice(0, 4) : [];
        if (!signal?.aborted) {
          setInsights(nextInsights);
          setFailed(nextInsights.length === 0);
        }
      } catch (error) {
        if (!signal?.aborted) {
          console.error("[ConsumptionSummaryPanel] failed", error);
          setInsights([]);
          setFailed(true);
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [currentUserId, endpoint, locale]
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void load(false, controller.signal);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load]);

  if (loading && insights.length === 0) return <LoadingCard label={t("summary.generating")} />;
  if (failed || insights.length === 0) return null;

  const displayInsights = insights.flatMap((insight) => {
    const text = formatInsightText(insight, currency, locale);
    return text === null ? [] : [{ insight, text }];
  });
  if (displayInsights.length === 0) return null;

  return (
    <section className="min-h-44 rounded-[14px] bg-ink p-5 text-surface sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{t("summary.title")}</h2>
          <p className="mt-1 text-xs text-ink-soft">{t("summary.description")}</p>
        </div>
        <IconButton
          icon={RefreshCw}
          label={t(loading ? "summary.regenerating" : "summary.regenerate")}
          disabled={loading}
          onClick={() => void load(true)}
          className="bg-surface"
        />
      </div>

      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {displayInsights.map(({ insight, text }, index) => (
          <li
            key={`${insight.kind}-${insight.text}-${index}`}
            className="flex min-w-0 items-start gap-3 rounded-[14px] bg-inset px-4 py-3"
          >
            <span
              className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-sm ${KIND_STYLES[insight.kind]}`}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-6 text-ink">
                {text}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
