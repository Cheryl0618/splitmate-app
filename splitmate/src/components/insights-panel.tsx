"use client";

import { useCallback, useEffect, useState } from "react";

import { formatCents } from "@/lib/format";
import { useCurrentUser } from "@/lib/current-user";
import type { Insight, InsightKind } from "@/lib/insights";

const KIND_STYLES: Record<InsightKind, string> = {
  trend: "bg-sky-500",
  pattern: "bg-teal-500",
  suggestion: "bg-amber-400",
  anomaly: "bg-rose-500",
};

function isInsight(value: unknown): value is Insight {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.text === "string" &&
    ["trend", "pattern", "suggestion", "anomaly"].includes(String(item.kind)) &&
    (item.relatedCents === undefined || Number.isSafeInteger(item.relatedCents))
  );
}

function LoadingCard() {
  return (
    <section
      aria-label="正在生成消费洞察"
      aria-busy="true"
      className="min-h-44 animate-pulse rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,0.05)] sm:p-6"
    >
      <div className="h-5 w-28 rounded bg-slate-200" />
      <div className="mt-5 space-y-3">
        <div className="h-11 rounded-2xl bg-slate-100" />
        <div className="h-11 rounded-2xl bg-slate-100" />
      </div>
    </section>
  );
}

export function InsightsPanel({ endpoint }: { endpoint: string }) {
  const { currentUserId } = useCurrentUser();
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
          headers: { "x-demo-user-id": currentUserId },
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
          console.error("[InsightsPanel] failed", error);
          setInsights([]);
          setFailed(true);
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [currentUserId, endpoint]
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(false, controller.signal);
    return () => controller.abort();
  }, [load]);

  if (loading && insights.length === 0) return <LoadingCard />;
  if (failed || insights.length === 0) return null;

  return (
    <section className="min-h-44 rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,0.05)] sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">AI 消费洞察</h2>
          <p className="mt-1 text-xs text-slate-400">根据当前聚合统计生成</p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void load(true)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:border-teal-300 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "生成中…" : "重新生成"}
        </button>
      </div>

      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {insights.map((insight, index) => (
          <li
            key={`${insight.kind}-${insight.text}-${index}`}
            className="flex min-w-0 items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3"
          >
            <span
              className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-sm ${KIND_STYLES[insight.kind]}`}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-6 text-slate-700">
                {insight.text}
              </p>
              {insight.relatedCents !== undefined ? (
                <span className="mt-1 inline-flex rounded-full bg-white px-2 py-0.5 text-xs font-bold text-teal-700">
                  {formatCents(insight.relatedCents)}
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
