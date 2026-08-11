"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/logo";
import { IconLink } from "@/components/ui/icon-action";
import { useT } from "@/i18n/context";

function currentLocation(pathname: string, t: (key: string) => string) {
  if (pathname === "/") return t("nav.home");
  if (pathname === "/groups/new") return t("group.create");
  if (pathname === "/settings") return t("nav.settings");
  if (/^\/groups\/[^/]+\/settings$/.test(pathname)) return t("nav.groupSettings");
  if (/^\/groups\/[^/]+\/settle$/.test(pathname)) return t("nav.settlement");
  if (/^\/groups\/[^/]+\/members\/[^/]+$/.test(pathname)) return t("nav.relationship");
  if (/^\/groups\/[^/]+\/expenses\/new$/.test(pathname)) return t("nav.expenseNew");
  if (/^\/expenses\/[^/]+\/edit$/.test(pathname)) return t("nav.expenseEdit");
  if (/^\/expenses\/[^/]+$/.test(pathname)) return t("nav.expenseDetail");
  if (/^\/groups\/[^/]+$/.test(pathname)) return t("nav.groupDetail");
  return t("nav.page");
}

export function SiteNav() {
  const pathname = usePathname();
  const { t } = useT();

  if (pathname === "/welcome") return null;

  return (
    <nav
      aria-label={t("nav.global")}
      className="sticky top-0 z-50 border-b border-line bg-surface backdrop-blur"
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-8 lg:px-12">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
          aria-label={t("nav.backHome")}
        >
          <Logo size={26} />
          <span className="brand-wordmark text-[24px] text-ink">
            Quits
          </span>
        </Link>

        <div className="flex min-w-0 items-center gap-2 text-sm" aria-label={t("nav.current")}>
          {pathname !== "/" ? (
            <>
              <Link href="/" className="shrink-0 font-semibold text-ink hover:opacity-70">
                {t("nav.home")}
              </Link>
              <span className="text-ink-soft" aria-hidden="true">
                /
              </span>
            </>
          ) : null}
          <span
            aria-current="page"
            className="truncate rounded-full bg-inset px-3 py-1.5 font-bold text-ink"
          >
            {currentLocation(pathname, t)}
          </span>
          {pathname !== "/settings" ? (
            <IconLink
              href="/settings"
              icon={Settings}
              label={t("nav.openSettings")}
            />
          ) : null}
        </div>
      </div>
    </nav>
  );
}
