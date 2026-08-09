"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useCurrentUser } from "@/lib/current-user";

export function ExpenseActions({
  expenseId,
  groupId,
  createdById,
}: {
  expenseId: string;
  groupId: string;
  createdById: string;
}) {
  const router = useRouter();
  const { currentUserId } = useCurrentUser();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  if (currentUserId !== createdById) return null;

  async function handleDelete() {
    if (!window.confirm("确定要删除这笔账单吗？删除后无法恢复。")) return;

    setIsDeleting(true);
    setError("");
    try {
      const response = await fetch(`/api/expenses/${expenseId}`, {
        method: "DELETE",
        headers: { "x-demo-user-id": currentUserId },
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "删除账单失败");

      router.push(`/groups/${groupId}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "删除账单失败");
      setIsDeleting(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="flex gap-3">
        <Link
          href={`/expenses/${expenseId}/edit`}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:border-teal-300 hover:text-teal-700"
        >
          编辑
        </Link>
        <button
          type="button"
          disabled={isDeleting}
          onClick={handleDelete}
          className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isDeleting ? "删除中…" : "删除"}
        </button>
      </div>
      {error ? (
        <p className="mt-3 text-sm font-semibold text-rose-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
