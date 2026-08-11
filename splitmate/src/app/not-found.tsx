"use client";

import Link from "next/link";
import { useT } from "@/i18n/context";

export default function NotFound() {
  const { t } = useT();
  return (
    <main className="grid min-h-[calc(100vh-4rem)] place-items-center bg-bg px-4 py-10 text-ink">
      <section className="w-full max-w-xl rounded-[14px] bg-surface px-5 py-12 text-center sm:px-8">
        <p className="text-sm font-black tracking-[0.2em] text-ink">404</p>
        <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl">{t("empty.notFoundTitle")}</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink-soft">
          {t("empty.notFoundDescription")}
        </p>
        <Link
          href="/"
          className="mt-7 inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-surface hover:opacity-85"
        >
          {t("empty.backHome")}
        </Link>
      </section>
    </main>
  );
}
