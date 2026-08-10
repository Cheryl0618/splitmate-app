"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useCurrentUser } from "@/lib/current-user";

export function GroupMembersForm({ groupId }: { groupId: string }) {
  const router = useRouter();
  const { currentUserId } = useCurrentUser();
  const [memberNames, setMemberNames] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!memberNames.trim() || saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/groups/${groupId}/members`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-demo-user-id": currentUserId,
        },
        body: JSON.stringify({ memberNames }),
      });
      const result = (await response.json()) as { addedCount?: number; error?: string };
      if (!response.ok) throw new Error(result.error || "添加成员失败");
      setMemberNames("");
      setMessage(
        result.addedCount
          ? `已添加 ${result.addedCount} 位成员`
          : "这些成员已经在群组中"
      );
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "添加成员失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      id="members"
      className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] sm:p-8"
    >
      <h2 className="text-xl font-extrabold">添加成员</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        已有账号的名字会自动关联，其他名字会作为虚拟成员加入。
      </p>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <textarea
          value={memberNames}
          onChange={(event) => setMemberNames(event.target.value)}
          placeholder={"例如「小明，小红」\n支持逗号或换行分隔"}
          rows={4}
          className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
        />
        {error ? <p className="text-sm font-semibold text-rose-600" role="alert">{error}</p> : null}
        {message ? <p className="text-sm font-semibold text-emerald-600" role="status">{message}</p> : null}
        <button
          type="submit"
          disabled={!memberNames.trim() || saving}
          className="rounded-xl bg-teal-600 px-5 py-3 text-sm font-bold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {saving ? "添加中…" : "添加成员"}
        </button>
      </form>
    </section>
  );
}
