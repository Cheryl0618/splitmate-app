"use client";

import Link from "next/link";
import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";

import { IconButton } from "@/components/ui/icon-action";
import { supportedCurrencies, type Currency } from "@/lib/currency";
import { useCurrentUser } from "@/lib/current-user";
import { useT } from "@/i18n/context";

function PageFrame({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-bg px-4 py-10 text-ink">
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
  const { locale, t } = useT();
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
            "x-ui-locale": locale,
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
        throw new Error(result.error || t("group.saveError"));
      }
      router.push(`/groups/${result.groupId}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("group.saveError"));
      setSaving(false);
    }
  }

  const content = (
    <>
      {modal ? (
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-ink">{t("group.newLedger")}</p>
            <h1 id="create-group-title" className="mt-1 text-2xl font-extrabold">
              {t("group.create")}
            </h1>
          </div>
          <IconButton
            icon={X}
            label={t("group.closeCreate")}
            disabled={saving}
            onClick={onCancel}
            className="bg-surface"
          />
        </div>
      ) : (
        <>
          <Link
            href={initialValue ? `/groups/${initialValue.id}` : "/"}
            className="text-sm font-bold text-ink hover:opacity-70"
          >
            {t("group.cancelBack")}
          </Link>
          <div className="pb-7 pt-10">
            <p className="text-sm font-bold text-ink">{t("nav.groupSettings")}</p>
            <h1 className="mt-2 text-3xl font-extrabold">
              {t(initialValue ? "group.edit" : "group.create")}
            </h1>
          </div>
        </>
      )}

      <form
        onSubmit={submit}
        className={`space-y-5 ${
          modal
            ? "mt-6"
            : "rounded-[14px] bg-surface p-5 sm:p-8"
        }`}
      >
        <label className="block text-sm font-bold text-ink">
          {t("group.name")}
          <input
            autoFocus={!initialValue}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("group.namePlaceholder")}
            className="mt-2 w-full rounded-[14px] border border-line px-4 py-3 outline-none focus:border-line focus:ring-2 focus:ring-ink"
          />
        </label>
        <label className="block text-sm font-bold text-ink">
          {t("group.currency")}
          <select
            value={currency}
            onChange={(event) => setCurrency(event.target.value as Currency)}
            className="mt-2 w-full rounded-[14px] border border-line bg-surface px-4 py-3 outline-none focus:border-line focus:ring-2 focus:ring-ink"
          >
            {supportedCurrencies.map((option) => (
              <option key={option} value={option}>{t(`currency.${option}`)}</option>
            ))}
          </select>
          <span className="mt-2 block text-xs font-medium leading-5 text-ink-soft">
            {t("common.currencyNote")}
          </span>
        </label>

        {!initialValue ? (
          <label className="block text-sm font-bold text-ink">
            {t("group.memberNames")}
            <textarea
              value={memberNames}
              onChange={(event) => setMemberNames(event.target.value)}
              placeholder={t("group.memberNamesPlaceholder")}
              rows={3}
              className="mt-2 w-full resize-none rounded-[14px] border border-line px-4 py-3 outline-none focus:border-line focus:ring-2 focus:ring-ink"
            />
            <span className="mt-2 block text-xs font-semibold text-ink">
              {t("group.autoJoin")}
            </span>
          </label>
        ) : null}

        {error ? (
          <p className="text-sm font-semibold text-ink" role="alert">{error}</p>
        ) : null}
        <button
          type="submit"
          disabled={!name.trim() || saving}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 font-bold text-surface hover:opacity-85 disabled:cursor-not-allowed disabled:bg-inset"
        >
          {!initialValue ? <Plus aria-hidden="true" size={18} strokeWidth={2} /> : null}
          {t(saving ? "common.saving" : initialValue ? "group.saveSettings" : "group.createAndEnter")}
        </button>
      </form>
    </>
  );

  if (modal) {
    return (
      <div
        className="fixed inset-0 z-50 grid place-items-center bg-ink/40 px-4 py-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-group-title"
      >
        <div className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-[14px] bg-surface p-5 sm:p-7">
          {content}
        </div>
      </div>
    );
  }

  if (embedded) return content;

  return <PageFrame>{content}</PageFrame>;
}
