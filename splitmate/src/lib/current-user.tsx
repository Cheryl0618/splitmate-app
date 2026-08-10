"use client";

import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

export interface AccountUser {
  id: string;
  displayName: string;
}

const CURRENT_USER_STORAGE_KEY = "splitmate-current-user-id";

interface CurrentUserContextValue {
  currentUserId: string;
  setCurrentUserId: (userId: string) => void;
  resetCurrentUser: () => void;
}

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

export function CurrentUserProvider({
  children,
  users,
}: {
  children: ReactNode;
  users: AccountUser[];
}) {
  const router = useRouter();
  const [currentUserId, setStoredUserId] = useState<string | null | undefined>(
    undefined
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedUserId = window.localStorage.getItem(CURRENT_USER_STORAGE_KEY);
      setStoredUserId(
        storedUserId && users.some((user) => user.id === storedUserId)
          ? storedUserId
          : null
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [users]);

  const setCurrentUserId = useCallback((userId: string) => {
    if (!users.some((user) => user.id === userId)) return;
    window.localStorage.setItem(CURRENT_USER_STORAGE_KEY, userId);
    setStoredUserId(userId);
  }, [users]);

  const resetCurrentUser = useCallback(() => {
    window.localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    setStoredUserId(null);
  }, []);

  const value = useMemo(
    () => ({ currentUserId: currentUserId ?? "", setCurrentUserId, resetCurrentUser }),
    [currentUserId, resetCurrentUser, setCurrentUserId]
  );

  if (currentUserId === undefined) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f8f7] px-4 text-slate-500">
        <p className="text-sm font-semibold">正在读取身份…</p>
      </main>
    );
  }

  return (
    <CurrentUserContext.Provider value={value}>
      {currentUserId ? (
        children
      ) : (
        <main className="grid min-h-screen place-items-center bg-[#f6f8f7] px-4 py-12 text-slate-900">
          <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:p-8">
            <p className="text-sm font-bold text-teal-700">SplitMate</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight">你是谁？</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              选择一次后会记在这台设备上，之后直接按你的身份显示。
            </p>
            <div className="mt-6 grid gap-3">
              {users.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => {
                    setCurrentUserId(user.id);
                    router.replace("/");
                  }}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-left font-bold hover:border-teal-400 hover:bg-teal-50"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-teal-100 text-teal-800">
                    {user.displayName.slice(0, 1).toUpperCase()}
                  </span>
                  {user.displayName}
                </button>
              ))}
            </div>
            {users.length === 0 ? (
              <p className="mt-6 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                还没有可选账号，请先运行数据库 seed。
              </p>
            ) : null}
          </section>
        </main>
      )}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser() {
  const context = useContext(CurrentUserContext);
  if (!context) {
    throw new Error("useCurrentUser must be used within CurrentUserProvider");
  }
  return context;
}
