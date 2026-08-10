"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function currentLocation(pathname: string) {
  if (pathname === "/") return "首页";
  if (/^\/groups\/[^/]+\/settle$/.test(pathname)) return "结算方案";
  if (/^\/groups\/[^/]+\/members\/[^/]+$/.test(pathname)) return "关系画像";
  if (/^\/groups\/[^/]+\/expenses\/new$/.test(pathname)) return "新建账单";
  if (/^\/expenses\/[^/]+\/edit$/.test(pathname)) return "编辑账单";
  if (/^\/expenses\/[^/]+$/.test(pathname)) return "账单详情";
  if (/^\/groups\/[^/]+$/.test(pathname)) return "群组详情";
  return "页面";
}

export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="全局导航"
      className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur"
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-8 lg:px-12">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-3 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          aria-label="返回 SplitMate 首页"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-600 font-black text-white shadow-sm">
            S
          </span>
          <span className="hidden font-extrabold tracking-tight text-slate-900 sm:inline">
            SplitMate
          </span>
        </Link>

        <div className="flex min-w-0 items-center gap-2 text-sm" aria-label="当前位置">
          {pathname !== "/" ? (
            <>
              <Link href="/" className="shrink-0 font-semibold text-slate-500 hover:text-teal-700">
                首页
              </Link>
              <span className="text-slate-300" aria-hidden="true">
                /
              </span>
            </>
          ) : null}
          <span
            aria-current="page"
            className="truncate rounded-full bg-teal-50 px-3 py-1.5 font-bold text-teal-700"
          >
            {currentLocation(pathname)}
          </span>
        </div>
      </div>
    </nav>
  );
}
