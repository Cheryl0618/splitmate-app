"use client";

import Link from "next/link";
import { useEffect, useTransition } from "react";
import { useT } from "@/i18n/context";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const [isRetrying, startTransition] = useTransition();
  const { t } = useT();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-[calc(100vh-4rem)] place-items-center bg-bg px-4 py-10 text-ink">
      <section className="w-full max-w-xl rounded-[14px] bg-surface px-5 py-12 text-center sm:px-8">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-inset text-2xl font-black text-ink">
          !
        </span>
        <h1 className="mt-5 text-2xl font-extrabold sm:text-3xl">{t("error.title")}</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink-soft">
          {t("error.description")}
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            disabled={isRetrying}
            onClick={() => startTransition(() => retry())}
            className="min-h-11 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-surface hover:opacity-85 disabled:cursor-not-allowed disabled:bg-inset"
          >
            {t(isRetrying ? "error.reloading" : "error.reload")}
          </button>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-surface px-5 py-2.5 text-sm font-bold text-ink hover:opacity-70"
          >
            {t("empty.backHome")}
          </Link>
        </div>
      </section>
    </main>
  );
}
