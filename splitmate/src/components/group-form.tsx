"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";

import { currencyLabels, supportedCurrencies, type Currency } from "@/lib/currency";
import { useCurrentUser } from "@/lib/current-user";

function PageFrame({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f6f8f7] px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-xl">{children}</div>
    </main>
  );
}

export function GroupForm({
  initialValue,
  modal = false,
  embedded = false,
  onCancel,
}: {
  initialValue?: { id: string; name: string; currency: Currency };
  modal?: boolean;
  embedded?: boolean;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const { currentUserId } = useCurrentUser();
  const [name, setName] = useState(initialValue?.name ?? "");
  const [currency, setCurrency] = useState<Currency>(initialValue?.currency ?? "CNY");
  const [memberNames, setMemberNames] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        initialValue ? `/api/groups/${initialValue.id}` : "/api/groups",
        {
          method: initialValue ? "PATCH" : "POST",
          headers: {
            "content-type": "application/json",
            "x-demo-user-id": currentUserId,
          },
          body: JSON.stringify({
            name: name.trim(),
            currency,
            ...(!initialValue ? { memberNames } : {}),
          }),
        }
      );
      const result = (await response.json()) as { groupId?: string; error?: string };
      if (!response.ok || !result.groupId) {
        throw new Error(result.error || "保存群组失败");
      }
      router.push(`/groups/${result.groupId}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存群组失败");
      setSaving(false);
    }
  }

  const content = (
    <>
      {modal ? (
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-teal-700">新共享账本</p>
            <h1 id="create-group-title" className="mt-1 text-2xl font-extrabold">
              创建群组
            </h1>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={onCancel}
            className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-lg font-bold text-slate-500 hover:bg-slate-200"
            aria-label="关闭创建群组弹窗"
          >
            ×
          </button>
        </div>
      ) : (
        <>
          <Link
            href={initialValue ? `/groups/${initialValue.id}` : "/"}
            className="text-sm font-bold text-slate-500 hover:text-teal-700"
          >
            ← 取消并返回
          </Link>
          <div className="pb-7 pt-10">
            <p className="text-sm font-bold text-teal-700">群组设置</p>
            <h1 className="mt-2 text-3xl font-extrabold">
              {initialValue ? "修改群组" : "创建群组"}
            </h1>
          </div>
        </>
      )}

      <form
        onSubmit={submit}
        className={`space-y-5 ${
          modal
            ? "mt-6"
            : "rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] sm:p-8"
        }`}
      >
        <label className="block text-sm font-bold text-slate-700">
          群组名称
          <input
            autoFocus={!initialValue}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例如「周末海边」"
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
          />
        </label>
        <label className="block text-sm font-bold text-slate-700">
          群组货币
          <select
            value={currency}
            onChange={(event) => setCurrency(event.target.value as Currency)}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
          >
            {supportedCurrencies.map((option) => (
              <option key={option} value={option}>{currencyLabels[option]}</option>
            ))}
          </select>
          <span className="mt-2 block text-xs font-medium leading-5 text-slate-400">
            只改变金额显示，不进行汇率换算；群组内所有账单使用同一种货币。
          </span>
        </label>

        {!initialValue ? (
          <label className="block text-sm font-bold text-slate-700">
            成员名字
            <textarea
              value={memberNames}
              onChange={(event) => setMemberNames(event.target.value)}
              placeholder={"例如「小明，小红」\n也可以每行输入一个名字"}
              rows={3}
              className="mt-2 w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
            <span className="mt-2 block text-xs font-semibold text-teal-700">
              你会自动加入这个群组
            </span>
          </label>
        ) : null}

        {error ? (
          <p className="text-sm font-semibold text-rose-600" role="alert">{error}</p>
        ) : null}
        <button
          type="submit"
          disabled={!name.trim() || saving}
          className="w-full rounded-2xl bg-teal-600 px-5 py-3 font-bold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {saving ? "保存中…" : initialValue ? "保存设置" : "创建并进入群组"}
        </button>
      </form>
    </>
  );

  if (modal) {
    return (
      <div
        className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4 py-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-group-title"
      >
        <div className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-7">
          {content}
        </div>
      </div>
    );
  }

  if (embedded) return content;

  return <PageFrame>{content}</PageFrame>;
}
