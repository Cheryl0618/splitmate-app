"use client";

import { useCurrentUser } from "@/lib/current-user";
import type { DemoUserSummary } from "@/server/groups";

export function UserSwitcher({ users }: { users: DemoUserSummary[] }) {
  const { currentUserId, setCurrentUserId } = useCurrentUser();

  return (
    <label className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <span className="grid h-8 w-8 place-items-center rounded-full bg-teal-600 text-sm font-bold text-white">
        {users.find((user) => user.id === currentUserId)?.displayName.slice(0, 1) ?? "李"}
      </span>
      <span className="sr-only">切换当前用户</span>
      <select
        aria-label="切换当前用户"
        className="cursor-pointer bg-transparent pr-1 text-sm font-semibold text-slate-700 outline-none"
        value={currentUserId}
        onChange={(event) => setCurrentUserId(event.target.value)}
      >
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.displayName}
          </option>
        ))}
      </select>
    </label>
  );
}
