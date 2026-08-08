"use client";

import { useCurrentUser } from "@/lib/current-user";
import type { DemoUserSummary, GroupCardData } from "@/server/groups";
import { UserSwitcher } from "./user-switcher";

const avatarColors = [
  "bg-teal-100 text-teal-800",
  "bg-amber-100 text-amber-800",
  "bg-sky-100 text-sky-800",
  "bg-violet-100 text-violet-800",
  "bg-rose-100 text-rose-800",
];

function formatCurrency(amountCents: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountCents / 100);
}

function Balance({ amountCents }: { amountCents: number }) {
  if (amountCents > 0) {
    return (
      <p className="font-semibold text-emerald-600">
        别人欠你 {formatCurrency(amountCents)}
      </p>
    );
  }
  if (amountCents < 0) {
    return (
      <p className="font-semibold text-rose-600">
        你欠别人 {formatCurrency(Math.abs(amountCents))}
      </p>
    );
  }
  return <p className="font-semibold text-slate-500">已结清</p>;
}

export function HomeDashboard({
  users,
  groups,
}: {
  users: DemoUserSummary[];
  groups: GroupCardData[];
}) {
  const { currentUserId } = useCurrentUser();
  const currentUser = users.find((user) => user.id === currentUserId) ?? users[0];
  const visibleGroups = groups.filter((group) =>
    group.members.some((member) => member.userId === currentUser?.id)
  );

  return (
    <main className="min-h-screen bg-[#f6f8f7] text-slate-900">
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-600 text-xl font-black text-white shadow-sm">
              S
            </span>
            <div>
              <p className="text-lg font-extrabold tracking-tight">SplitMate</p>
              <p className="text-xs text-slate-500">一起记，轻松结</p>
            </div>
          </div>
          <UserSwitcher users={users} />
        </header>

        <section className="pb-8 pt-16 sm:pt-20">
          <p className="mb-2 text-sm font-semibold text-teal-700">
            你好，{currentUser?.displayName ?? "小李"}
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            你的群组
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">
            一眼看清共同账目，谁该收、谁该付，都在这里。
          </p>
        </section>

        <section className="grid gap-5 pb-16 md:grid-cols-2">
          {visibleGroups.map((group) => (
            <article
              key={group.id}
              className="group rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_14px_40px_rgba(15,23,42,0.06)] transition-transform hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-teal-600">
                    共享账本
                  </p>
                  <h2 className="text-2xl font-bold tracking-tight">{group.name}</h2>
                </div>
                <span className="grid h-10 w-10 place-items-center rounded-full bg-slate-50 text-lg text-slate-400 transition-colors group-hover:bg-teal-50 group-hover:text-teal-600">
                  →
                </span>
              </div>

              <div className="mt-8 flex items-end justify-between gap-5 border-t border-slate-100 pt-5">
                <div>
                  <p className="mb-2 text-xs font-medium text-slate-400">当前余额</p>
                  <Balance amountCents={group.balancesByUserId[currentUserId] ?? 0} />
                </div>
                <div className="flex -space-x-2" aria-label={`${group.members.length} 位成员`}>
                  {group.members.map((member, index) => (
                    <span
                      key={member.id}
                      title={member.displayName}
                      className={`grid h-9 w-9 place-items-center rounded-full border-2 border-white text-xs font-bold ${avatarColors[index % avatarColors.length]}`}
                    >
                      {member.displayName.slice(0, 1).toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
