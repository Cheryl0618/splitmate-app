"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Logo } from "@/components/logo";
import { useCurrentUser } from "@/lib/current-user";
import { useT } from "@/i18n/context";
import type { UserProfileSummary } from "@/server/settings";

type Mode = "register" | "login";
type FieldErrors = Partial<Record<"displayName" | "email" | "password" | "form", string>>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function WelcomeScreen() {
  const router = useRouter();
  const { locale, setLocale, t } = useT();
  const { setLocalIdentity } = useCurrentUser();
  const [mode, setMode] = useState<Mode>("register");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState<"register" | "login" | "direct" | null>(null);

  function validateName() {
    const length = Array.from(displayName.trim()).length;
    return length >= 2 && length <= 20 ? "" : "welcome.nameError";
  }

  function validateCredentials(includeName: boolean) {
    const next: FieldErrors = {};
    if (includeName) {
      const nameError = validateName();
      if (nameError) next.displayName = nameError;
    }
    if (!emailPattern.test(email.trim())) next.email = "welcome.emailError";
    if (password.length < 8) next.password = "welcome.passwordError";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function enter(
    entryMode: "register" | "login" | "direct"
  ) {
    if (submitting) return;
    if (entryMode === "direct") {
      const nameError = validateName();
      if (nameError) {
        setMode("register");
        setErrors({ displayName: nameError });
        return;
      }
      setErrors({});
    } else if (!validateCredentials(entryMode === "register")) {
      return;
    }

    setSubmitting(entryMode);
    try {
      const response = await fetch("/api/welcome", {
        method: "POST",
        headers: { "content-type": "application/json", "x-ui-locale": locale },
        body: JSON.stringify({
          mode: entryMode,
          displayName: displayName.trim(),
          email: email.trim(),
          password,
        }),
      });
      const body = (await response.json()) as UserProfileSummary & { error?: string };
      if (!response.ok || !body.id) {
        if (entryMode === "register" && response.status === 409) {
          setErrors({ email: "welcome.emailRegistered" });
        } else if (entryMode === "login" && response.status === 401) {
          setErrors({ email: "welcome.credentialsError" });
        } else {
          setErrors({ form: "welcome.genericError" });
        }
        return;
      }
      setLocalIdentity(body);
      router.replace("/");
      router.refresh();
    } catch {
      setErrors({ form: "welcome.genericError" });
    } finally {
      setSubmitting(null);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void enter(mode);
  }

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setErrors({});
  }

  return (
    <main className="relative grid min-h-screen place-items-center bg-bg px-4 py-10 text-ink">
      <div
        className="fixed right-5 top-5 z-10 flex items-center text-[13px]"
        role="group"
        aria-label={t("welcome.language")}
      >
        <button
          type="button"
          aria-pressed={locale === "zh"}
          onClick={() => setLocale("zh")}
          className={`inline-flex min-h-[30px] min-w-11 items-center justify-center px-2 ${
            locale === "zh" ? "font-medium text-ink" : "font-normal text-ink-soft"
          }`}
        >
          {t("settings.chinese")}
        </button>
        <span className="px-1 text-ink-soft" aria-hidden="true">·</span>
        <button
          type="button"
          aria-pressed={locale === "en"}
          onClick={() => setLocale("en")}
          className={`inline-flex min-h-[30px] min-w-11 items-center justify-center px-2 ${
            locale === "en" ? "font-medium text-ink" : "font-normal text-ink-soft"
          }`}
        >
          English
        </button>
      </div>
      <div className="w-full max-w-[340px]">
        <header className="text-center">
          <Logo size={48} className="mx-auto" />
          <p className="brand-wordmark mt-3 text-[42px] text-ink">Quits</p>
          <p className="mt-1 text-sm font-medium text-ink-soft">
            Split bills. Settle clean.
          </p>
        </header>

        <section className="mt-7 rounded-2xl bg-surface p-5">
          <div className="grid grid-cols-2 rounded-[10px] bg-inset p-1" role="tablist" aria-label={t("welcome.entryMode")}>
            {(["register", "login"] as const).map((option) => {
              const selected = mode === option;
              return (
                <button
                  key={option}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => switchMode(option)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                    selected ? "bg-surface text-ink" : "text-ink-soft"
                  }`}
                >
                  {t(option === "register" ? "welcome.register" : "welcome.login")}
                </button>
              );
            })}
          </div>

          <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
            {mode === "register" ? (
              <label className="block text-xs font-medium text-ink-soft">
                {t("welcome.name")}
                <input
                  autoFocus
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  maxLength={20}
                  className="mt-1.5 w-full rounded-[10px] border border-line bg-surface px-3.5 py-3 text-sm text-ink outline-none focus:border-accent"
                />
                {errors.displayName ? (
                  <span className="mt-1.5 block text-xs text-accent" role="alert">
                    {t(errors.displayName)}
                  </span>
                ) : null}
              </label>
            ) : null}

            <label className="block text-xs font-medium text-ink-soft">
              {t("welcome.email")}
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1.5 w-full rounded-[10px] border border-line bg-surface px-3.5 py-3 text-sm text-ink outline-none focus:border-accent"
              />
              {errors.email ? (
                <span className="mt-1.5 block text-xs text-accent" role="alert">
                  {t(errors.email)}
                </span>
              ) : null}
            </label>

            <label className="block text-xs font-medium text-ink-soft">
              {t("welcome.password")}
              <input
                type="password"
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1.5 w-full rounded-[10px] border border-line bg-surface px-3.5 py-3 text-sm text-ink outline-none focus:border-accent"
              />
              {errors.password ? (
                <span className="mt-1.5 block text-xs text-accent" role="alert">
                  {t(errors.password)}
                </span>
              ) : mode === "register" ? (
                <span className="mt-1.5 block text-xs text-ink-soft">
                  {t("welcome.passwordHint")}
                </span>
              ) : null}
            </label>

            {errors.form ? (
              <p className="text-xs text-accent" role="alert">{t(errors.form)}</p>
            ) : null}

            {mode === "register" ? (
              <p className="text-xs leading-5 text-ink-soft">
                {t("welcome.syncDescription")}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting !== null}
              className="w-full rounded-full bg-accent px-5 py-3 text-sm font-bold text-surface hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting === mode
                ? t(mode === "register" ? "welcome.registering" : "welcome.loggingIn")
                : t(mode === "register" ? "welcome.registerAction" : "welcome.loginAction")}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-ink-soft" aria-hidden="true">
            <span className="h-px flex-1 bg-line" />
            {t("welcome.or")}
            <span className="h-px flex-1 bg-line" />
          </div>

          <button
            type="button"
            disabled={submitting !== null}
            onClick={() => void enter("direct")}
            className="w-full rounded-full border border-ink bg-surface px-5 py-3 text-sm font-bold text-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t(submitting === "direct" ? "welcome.preparing" : "welcome.direct")}
          </button>
          <div className="mt-3 text-center text-[11px] leading-5 text-ink-soft">
            <p>{t("welcome.localOnly")}</p>
            <p>{t("welcome.bindLater")}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
