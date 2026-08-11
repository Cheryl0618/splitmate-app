"use client";

import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { useCurrentUser } from "@/lib/current-user";
import { avatarColorClass } from "@/lib/avatar-colors";
import { formatCents } from "@/lib/format";
import type { Currency } from "@/lib/currency";
import type { GroupCardData } from "@/server/groups";
import { GroupForm } from "./group-form";
import { useT } from "@/i18n/context";

function Balance({ amountCents, currency }: { amountCents: number; currency: Currency }) {
  const { locale, t } = useT();
  if (amountCents > 0) {
    return (
      <p className="amount text-lg font-medium text-ink">
        {t("balance.owed")} {formatCents(amountCents, currency, locale)}
      </p>
    );
  }
  if (amountCents < 0) {
    return (
      <p className="amount text-lg font-medium text-accent">
        {t("balance.owe")} {formatCents(Math.abs(amountCents), currency, locale)}
      </p>
    );
  }
  return <p className="font-semibold text-ink-soft">{t("common.settled")}</p>;
}

export function HomeDashboard({
  groups,
}: {
  groups: GroupCardData[];
}) {
  const { currentUserId } = useCurrentUser();
  const { t } = useT();
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const visibleGroups = groups.filter((group) =>
    group.members.some((member) => member.userId === currentUserId)
  );

  return (
    <main className="min-h-screen bg-bg text-ink">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 lg:px-12">
        <header className="flex items-center justify-start gap-3">
          <button
            type="button"
            onClick={() => setShowCreateGroup(true)}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-surface hover:opacity-85"
          >
            <Plus aria-hidden="true" size={18} strokeWidth={2} />
            {t("group.create")}
          </button>
        </header>

        <section className="pb-8 pt-16 sm:pt-20">
          <p className="mb-2 text-sm font-semibold text-ink">
            {t("home.hello")}
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            {t("home.title")}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-ink-soft sm:text-base">
            {t("home.description")}
          </p>
        </section>

        {visibleGroups.length === 0 ? (
          <div className="pb-16">
            <EmptyState
              title={t("home.emptyTitle")}
              description={t("home.emptyDescription")}
              actionHref="/groups/new"
              actionLabel={t("home.createFirst")}
              onAction={() => setShowCreateGroup(true)}
              showPlusIcon
            />
          </div>
        ) : (
          <section className="grid gap-5 pb-16 md:grid-cols-2">
            {visibleGroups.map((group) => (
            <Link
              key={group.id}
              href={`/groups/${group.id}`}
              className="group block rounded-[14px] bg-surface p-6 transition-transform hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-ink">
                    {t("home.sharedLedger")}
                  </p>
                  <h2 className="text-2xl font-bold tracking-tight">{group.name}</h2>
                </div>
                <span className="grid h-10 w-10 place-items-center rounded-full bg-inset text-lg text-ink-soft transition-colors group-hover:bg-inset group-hover:text-ink">
                  <ChevronRight aria-hidden="true" size={20} strokeWidth={2} />
                </span>
              </div>

              <div className="mt-8 flex items-end justify-between gap-5 border-t border-line pt-5">
                <div>
                  <p className="mb-2 text-xs font-medium text-ink-soft">{t("home.currentBalance")}</p>
                  <Balance
                    amountCents={group.balancesByUserId[currentUserId] ?? 0}
                    currency={group.currency}
                  />
                </div>
                <div className="flex -space-x-2" aria-label={t("group.memberCount", { count: group.members.length })}>
                  {[...group.members]
                    .sort((left, right) => {
                      if (left.userId === currentUserId) return -1;
                      if (right.userId === currentUserId) return 1;
                      return 0;
                    })
                    .map((member) => (
                    <span
                      key={member.id}
                      title={member.userId === currentUserId ? t("common.you") : member.displayName}
                      className={`grid h-9 w-9 place-items-center rounded-full border-2 border-surface text-xs font-bold ${avatarColorClass(member.avatarColor)}`}
                    >
                      {(member.userId === currentUserId ? t("common.you") : member.displayName).slice(0, 1).toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
            ))}
          </section>
        )}
      </div>
      {showCreateGroup ? (
        <GroupForm modal onCancel={() => setShowCreateGroup(false)} />
      ) : null}
    </main>
  );
}
