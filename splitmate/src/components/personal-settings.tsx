"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useCurrentUser } from "@/lib/current-user";
import type { PersonalSettingsData } from "@/server/settings";

export function PersonalSettings() {
  const router = useRouter();
  const { currentUserId, resetCurrentUser } = useCurrentUser();
  const [data, setData] = useState<PersonalSettingsData | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/settings", {
      headers: { "x-demo-user-id": currentUserId },
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json()) as PersonalSettingsData & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "读取设置失败");
        setData(body);
        setDisplayName(body.displayName);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setMessage(String(error.message ?? error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [currentUserId]);

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-demo-user-id": currentUserId,
        },
        body: JSON.stringify({ displayName }),
      });
      const body = (await response.json()) as PersonalSettingsData & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "保存失败");
      setData(body);
      setDisplayName(body.displayName);
      setMessage("显示名已更新");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f8f7] px-4 py-10 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-bold text-teal-700">个人设置</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">我的账号</h1>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.05)] sm:p-7">
          <label htmlFor="display-name" className="text-sm font-bold text-slate-700">
            显示名
          </label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <input
              id="display-name"
              value={displayName}
              disabled={loading || saving}
              maxLength={50}
              onChange={(event) => setDisplayName(event.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
            <button
              type="button"
              disabled={loading || saving || !displayName.trim()}
              onClick={() => void save()}
              className="rounded-xl bg-teal-600 px-5 py-3 font-bold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
          {message ? <p className="mt-3 text-sm text-slate-500" role="status">{message}</p> : null}
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-semibold text-slate-500">当前群组数</p>
            <p className="mt-2 text-3xl font-extrabold tabular-nums">{data?.groupCount ?? "—"}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-semibold text-slate-500">账单总数</p>
            <p className="mt-2 text-3xl font-extrabold tabular-nums">{data?.expenseCount ?? "—"}</p>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 sm:p-7">
          <h2 className="font-bold">重新选择身份</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            数据重置或选错账号时，可以清除这台设备保存的身份并重新选择。
          </p>
          <button
            type="button"
            onClick={resetCurrentUser}
            className="mt-4 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-teal-300 hover:text-teal-700"
          >
            重新选择身份
          </button>
        </section>
      </div>
    </main>
  );
}
