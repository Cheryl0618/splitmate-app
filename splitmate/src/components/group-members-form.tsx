"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";

import { useCurrentUser } from "@/lib/current-user";
import { useT } from "@/i18n/context";

export function GroupMembersForm({ groupId }: { groupId: string }) {
  const router = useRouter();
  const { locale, t } = useT();
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
          "x-ui-locale": locale,
        },
        body: JSON.stringify({ memberNames }),
      });
      const result = (await response.json()) as { addedCount?: number; error?: string };
      if (!response.ok) throw new Error(result.error || t("members.addError"));
      setMemberNames("");
      setMessage(
        result.addedCount
          ? t("members.added", { count: result.addedCount })
          : t("members.alreadyAdded")
      );
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("members.addError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      id="members"
      className="mt-6 rounded-[14px] bg-surface p-5 sm:p-8"
    >
      <h2 className="text-xl font-extrabold">{t("members.add")}</h2>
      <p className="mt-2 text-sm leading-6 text-ink-soft">
        {t("members.description")}
      </p>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <textarea
          value={memberNames}
          onChange={(event) => setMemberNames(event.target.value)}
          placeholder={t("members.placeholder")}
          rows={4}
          className="w-full resize-none rounded-[14px] border border-line px-4 py-3 outline-none focus:border-line focus:ring-2 focus:ring-ink"
        />
        {error ? <p className="text-sm font-semibold text-ink" role="alert">{error}</p> : null}
        {message ? <p className="text-sm font-semibold text-ink" role="status">{message}</p> : null}
        <button
          type="submit"
          disabled={!memberNames.trim() || saving}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-bold text-surface hover:opacity-85 disabled:cursor-not-allowed disabled:bg-inset"
        >
          <Plus aria-hidden="true" size={18} strokeWidth={2} />
          {t(saving ? "members.adding" : "members.add")}
        </button>
      </form>
    </section>
  );
}
