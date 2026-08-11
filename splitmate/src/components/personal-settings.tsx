"use client";

import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { IconButton } from "@/components/ui/icon-action";
import { useCurrentUser } from "@/lib/current-user";
import {
  avatarColorOptions,
  DEFAULT_AVATAR_COLOR,
  type AvatarColor,
} from "@/lib/avatar-colors";
import type { PersonalSettingsData } from "@/server/settings";
import { useT } from "@/i18n/context";

export function PersonalSettings() {
  const router = useRouter();
  const { locale, setLocale, t } = useT();
  const { currentUserId, clearLocalIdentity } = useCurrentUser();
  const [data, setData] = useState<PersonalSettingsData | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarColor, setAvatarColor] =
    useState<AvatarColor>(DEFAULT_AVATAR_COLOR);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [syncEmail, setSyncEmail] = useState("");
  const [syncPassword, setSyncPassword] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [showBindingForm, setShowBindingForm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/settings", {
      headers: { "x-demo-user-id": currentUserId, "x-ui-locale": locale },
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json()) as PersonalSettingsData & { error?: string };
        if (!response.ok) throw new Error(t("settings.loadError"));
        setData(body);
        setDisplayName(body.displayName);
        setAvatarColor(body.avatarColor);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setMessage(String(error.message ?? error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [currentUserId, locale, t]);

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-demo-user-id": currentUserId,
          "x-ui-locale": locale,
        },
        body: JSON.stringify({ displayName, avatarColor }),
      });
      const body = (await response.json()) as PersonalSettingsData & { error?: string };
      if (!response.ok) throw new Error(t("settings.saveError"));
      setData(body);
      setDisplayName(body.displayName);
      setAvatarColor(body.avatarColor);
      setMessage(t("settings.updated"));
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("settings.saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function resetAllData() {
    if (resetting) return;
    setResetting(true);
    setResetError("");
    try {
      const response = await fetch("/api/settings/reset", {
        method: "POST",
        headers: { "x-demo-user-id": currentUserId, "x-ui-locale": locale },
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(t("settings.resetError"));
      window.localStorage.clear();
      clearLocalIdentity();
      router.replace("/");
      router.refresh();
    } catch (error) {
      setResetError(error instanceof Error ? error.message : t("settings.resetError"));
      setResetting(false);
    }
  }

  function focusEmailBinding() {
    setShowResetConfirm(false);
    setShowBindingForm(true);
    document.getElementById("email-sync")?.scrollIntoView({ behavior: "smooth" });
    window.setTimeout(() => {
      document.querySelector<HTMLInputElement>('#email-sync input[type="email"]')?.focus();
    }, 400);
  }

  async function bindEmail() {
    setSyncing(true);
    setSyncMessage("");
    try {
      const response = await fetch("/api/sync/binding", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-demo-user-id": currentUserId,
          "x-ui-locale": locale,
        },
        body: JSON.stringify({ email: syncEmail, password: syncPassword }),
      });
      const body = (await response.json()) as { email?: string; error?: string };
      if (!response.ok || !body.email) {
        throw new Error(t("settings.syncError"));
      }
      setData((current) => current ? { ...current, email: body.email! } : current);
      setSyncPassword("");
      setSyncMessage(t("settings.syncComplete"));
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : t("settings.syncError"));
    } finally {
      setSyncing(false);
    }
  }

  async function logout() {
    setSyncing(true);
    setSyncMessage("");
    try {
      const response = await fetch("/api/sync/session", {
        method: "DELETE",
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(t("settings.logoutError"));
      clearLocalIdentity();
      router.replace("/welcome");
      router.refresh();
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : t("settings.logoutError"));
    } finally {
      setSyncing(false);
    }
  }

  return (
    <main className="min-h-screen bg-bg px-4 py-10 text-ink sm:px-8">
      <div className="mx-auto max-w-3xl">
        <IconButton
          icon={ChevronLeft}
          label={t("settings.back")}
          onClick={() => router.back()}
          className="bg-surface"
        />
        <p className="mt-6 text-sm font-bold text-ink">{t("settings.section")}</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{t("settings.title")}</h1>

        <section className="mt-8 rounded-[14px] bg-surface p-5 sm:p-7">
          <label htmlFor="display-name" className="text-sm font-bold text-ink">
            {t("settings.name")}
          </label>
          <input
            id="display-name"
            value={displayName}
            disabled={loading || saving}
            minLength={2}
            maxLength={20}
            onChange={(event) => setDisplayName(event.target.value)}
            className="mt-2 w-full rounded-[14px] border border-line px-4 py-3 outline-none focus:border-line focus:ring-2 focus:ring-ink"
          />
          <fieldset className="mt-6">
            <legend className="text-sm font-bold text-ink">{t("settings.avatar")}</legend>
            <div className="mt-3 flex flex-wrap gap-3">
              {avatarColorOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-label={t(`avatar.${option.value}`)}
                  aria-pressed={avatarColor === option.value}
                  disabled={loading || saving}
                  onClick={() => setAvatarColor(option.value)}
                  className={`h-11 w-11 rounded-full ${option.swatchClass} ring-offset-2 ring-offset-surface disabled:opacity-50 ${
                    avatarColor === option.value
                      ? "ring-2 ring-ink"
                      : "ring-0"
                  }`}
                />
              ))}
            </div>
          </fieldset>
          {message ? <p className="mt-3 text-sm text-ink-soft" role="status">{message}</p> : null}
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              disabled={
                loading ||
                saving ||
                Array.from(displayName.trim()).length < 2 ||
                Array.from(displayName.trim()).length > 20
              }
              onClick={() => void save()}
              className="rounded-full bg-accent px-5 py-3 font-bold text-surface hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t(saving ? "common.saving" : "common.save")}
            </button>
          </div>
        </section>

        <section
          id="email-sync"
          className="mt-6 rounded-[14px] bg-surface p-5 sm:p-7"
        >
          <h2 className="text-xl font-extrabold">
            {t(data?.email ? "settings.syncState" : "settings.bindTitle")}
          </h2>
          {loading ? (
            <p className="mt-4 text-sm font-semibold text-ink-soft">{t("settings.syncLoading")}</p>
          ) : data?.email ? (
            <div className="mt-4">
              <p className="rounded-[14px] bg-inset px-4 py-3 font-bold text-ink">
                {t("settings.synced", { email: data.email })}
              </p>
              <p className="mt-3 text-sm leading-6 text-ink-soft">
                {t("settings.syncedDescription")}
              </p>
              <button
                type="button"
                disabled={syncing}
                onClick={() => void logout()}
                className="mt-4 rounded-full bg-surface px-4 py-2.5 text-sm font-bold text-ink hover:opacity-70 disabled:opacity-50"
              >
                {t(syncing ? "settings.loggingOut" : "settings.logout")}
              </button>
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-sm leading-6 text-ink-soft">
                {t("settings.optionalBackup")}
              </p>
              {showBindingForm ? (
                <div className="mt-4 space-y-4">
                  <label className="block text-sm font-bold text-ink">
                    {t("welcome.email")}
                    <input
                      type="email"
                      autoComplete="email"
                      value={syncEmail}
                      onChange={(event) => setSyncEmail(event.target.value)}
                      className="mt-1.5 w-full rounded-[14px] border border-line px-4 py-3 outline-none focus:border-line"
                    />
                  </label>
                  <label className="block text-sm font-bold text-ink">
                    {t("welcome.password")}
                    <input
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      value={syncPassword}
                      onChange={(event) => setSyncPassword(event.target.value)}
                      className="mt-1.5 w-full rounded-[14px] border border-line px-4 py-3 outline-none focus:border-line"
                    />
                    <span className="mt-1.5 block text-xs font-medium text-ink-soft">{t("settings.passwordHint")}</span>
                  </label>
                  <button
                    type="button"
                    disabled={syncing || !syncEmail.trim() || syncPassword.length < 8}
                    onClick={() => void bindEmail()}
                    className="rounded-full bg-accent px-5 py-3 font-bold text-surface hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t(syncing ? "settings.binding" : "settings.confirmBind")}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowBindingForm(true)}
                  className="mt-4 rounded-full bg-accent px-5 py-3 font-bold text-surface hover:opacity-85"
                >
                  {t("settings.bind")}
                </button>
              )}
            </div>
          )}
          {syncMessage ? <p className="mt-3 text-sm text-ink-soft" role="status">{syncMessage}</p> : null}
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-[14px] bg-surface p-5">
            <p className="text-sm font-semibold text-ink-soft">{t("settings.groupCount")}</p>
            <p className="mt-2 text-3xl font-extrabold tabular-nums">{data?.groupCount ?? "—"}</p>
          </div>
          <div className="rounded-[14px] bg-surface p-5">
            <p className="text-sm font-semibold text-ink-soft">{t("settings.expenseCount")}</p>
            <p className="mt-2 text-3xl font-extrabold tabular-nums">{data?.expenseCount ?? "—"}</p>
          </div>
        </section>

        <section className="mt-6 rounded-[14px] bg-surface p-5 sm:p-7">
          <h2 className="font-bold text-ink">{t("settings.language")}</h2>
          <div className="mt-4 flex gap-2" role="group" aria-label={t("settings.language")}>
            {(["zh", "en"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={locale === option}
                onClick={() => setLocale(option)}
                className={`rounded-full px-5 py-2.5 text-sm font-bold ${
                  locale === option ? "bg-accent text-surface" : "bg-inset text-ink"
                }`}
              >
                {t(option === "zh" ? "settings.chinese" : "settings.english")}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-[14px] bg-surface p-5 sm:p-7">
          <h2 className="font-bold text-ink">{t("settings.resetTitle")}</h2>
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            {t("settings.resetDescription")}
          </p>
          <button
            type="button"
            onClick={() => {
              setResetError("");
              setShowResetConfirm(true);
            }}
            className="mt-4 rounded-full bg-surface px-4 py-2.5 text-sm font-bold text-ink hover:opacity-70"
          >
            {t("settings.resetTitle")}
          </button>
        </section>
      </div>

      {showResetConfirm ? (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-ink/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-data-title"
        >
          <section className="w-full max-w-md rounded-[14px] bg-surface p-6 sm:p-7">
            <h2 id="reset-data-title" className="text-xl font-extrabold">
              {t("settings.resetConfirmTitle")}
            </h2>
            <p className="mt-3 text-sm leading-6 text-ink-soft">
              {t("settings.resetConfirmDescription")}
            </p>
            {!data?.email ? (
              <div className="mt-4 rounded-[14px] bg-inset p-4">
                <p className="text-sm font-semibold leading-6 text-ink">
                  {t("settings.notBackedUp")}
                </p>
                <button
                  type="button"
                  disabled={resetting}
                  onClick={focusEmailBinding}
                  className="mt-2 rounded-full bg-surface px-3 py-1.5 text-sm font-bold text-ink"
                >
                  {t("settings.bindFirst")}
                </button>
              </div>
            ) : null}
            {resetError ? (
              <p className="mt-4 text-sm font-semibold text-ink" role="alert">
                {resetError}
              </p>
            ) : null}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={resetting}
                onClick={() => setShowResetConfirm(false)}
                className="rounded-full bg-surface px-4 py-2.5 text-sm font-bold text-ink hover:opacity-70 disabled:opacity-50"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                disabled={resetting}
                onClick={() => void resetAllData()}
                className="rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-surface hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t(resetting ? "settings.resetting" : "settings.confirmReset")}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
