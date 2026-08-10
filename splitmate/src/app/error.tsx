"use client";

import Link from "next/link";
import { useEffect, useTransition } from "react";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const [isRetrying, startTransition] = useTransition();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-[calc(100vh-4rem)] place-items-center bg-[#f6f8f7] px-4 py-10 text-slate-900">
      <section className="w-full max-w-xl rounded-3xl border border-rose-200 bg-white px-5 py-12 text-center shadow-[0_16px_50px_rgba(15,23,42,0.06)] sm:px-8">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-rose-50 text-2xl font-black text-rose-600">
          !
        </span>
        <h1 className="mt-5 text-2xl font-extrabold sm:text-3xl">页面暂时没能打开</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
          数据读取时遇到了问题。你可以重新加载这一页，或者返回首页选择其他内容。
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            disabled={isRetrying}
            onClick={() => startTransition(() => retry())}
            className="min-h-11 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isRetrying ? "重新加载中…" : "重新加载"}
          </button>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:border-teal-300 hover:text-teal-700"
          >
            返回首页
          </Link>
        </div>
      </section>
    </main>
  );
}
