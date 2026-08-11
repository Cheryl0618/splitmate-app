"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { IconButton, IconLink } from "@/components/ui/icon-action";
import { useCurrentUser } from "@/lib/current-user";
import { useT } from "@/i18n/context";

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
  const { locale, t } = useT();
  const { currentUserId } = useCurrentUser();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  if (currentUserId !== createdById) return null;

  async function handleDelete() {
    if (!window.confirm(t("expense.deleteConfirm"))) return;

    setIsDeleting(true);
    setError("");
    try {
      const response = await fetch(`/api/expenses/${expenseId}`, {
        method: "DELETE",
        headers: { "x-demo-user-id": currentUserId, "x-ui-locale": locale },
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || t("expense.deleteError"));

      router.push(`/groups/${groupId}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("expense.deleteError"));
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-col items-end">
      <div className="flex gap-3">
        <IconLink
          href={`/expenses/${expenseId}/edit`}
          icon={Pencil}
          label={t("nav.expenseEdit")}
          className="bg-surface"
        />
        <IconButton
          icon={Trash2}
          label={t(isDeleting ? "expense.deleting" : "expense.delete")}
          dangerous
          disabled={isDeleting}
          onClick={handleDelete}
          className="bg-surface"
        />
      </div>
      {error ? (
        <p className="mt-2 text-right text-sm font-semibold text-ink" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
