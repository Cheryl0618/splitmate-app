"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import { DEFAULT_AVATAR_COLOR } from "@/lib/avatar-colors";
import type { UserProfileSummary } from "@/server/settings";
import { useT } from "@/i18n/context";

const CURRENT_USER_STORAGE_KEY = "quits-current-user-id";
const LEGACY_CURRENT_USER_STORAGE_KEY = `${["split", "mate"].join("")}-current-user-id`;

interface CurrentUserContextValue {
  currentUserId: string;
  currentUser: UserProfileSummary | null;
  setLocalIdentity: (profile: UserProfileSummary) => void;
  clearLocalIdentity: () => void;
}

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const { locale, t } = useT();
  const router = useRouter();
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<UserProfileSummary | null | undefined>(
    undefined
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const currentStoredUserId = window.localStorage.getItem(CURRENT_USER_STORAGE_KEY);
      const legacyStoredUserId = window.localStorage.getItem(
        LEGACY_CURRENT_USER_STORAGE_KEY
      );
      const storedUserId = currentStoredUserId ?? legacyStoredUserId;
      if (!storedUserId) {
        setCurrentUser(null);
        return;
      }
      if (!currentStoredUserId && legacyStoredUserId) {
        window.localStorage.setItem(CURRENT_USER_STORAGE_KEY, legacyStoredUserId);
        window.localStorage.removeItem(LEGACY_CURRENT_USER_STORAGE_KEY);
      }

      void fetch("/api/settings", {
        headers: { "x-demo-user-id": storedUserId, "x-ui-locale": locale },
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            if (response.status === 404 || response.status === 401) {
              window.localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
              setCurrentUser(null);
              return;
            }
            throw new Error("Could not read local profile");
          }
          const profile = (await response.json()) as UserProfileSummary;
          setCurrentUser(profile);
        })
        .catch((caught) => {
          if (!controller.signal.aborted) {
            console.error("[current-user] failed", caught);
            setCurrentUser({
              id: storedUserId,
              displayName: t("common.you"),
              avatarColor: DEFAULT_AVATAR_COLOR,
            });
          }
        });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [locale, t]);

  useEffect(() => {
    if (currentUser === null && pathname !== "/welcome") {
      router.replace("/welcome");
    } else if (currentUser && pathname === "/welcome") {
      router.replace("/");
    }
  }, [currentUser, pathname, router]);

  const setLocalIdentity = useCallback((profile: UserProfileSummary) => {
    window.localStorage.setItem(CURRENT_USER_STORAGE_KEY, profile.id);
    window.localStorage.removeItem(LEGACY_CURRENT_USER_STORAGE_KEY);
    setCurrentUser(profile);
  }, []);

  const clearLocalIdentity = useCallback(() => {
    window.localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_CURRENT_USER_STORAGE_KEY);
    setCurrentUser(null);
  }, []);

  const value = useMemo(
    () => ({
      currentUserId: currentUser?.id ?? "",
      currentUser: currentUser ?? null,
      setLocalIdentity,
      clearLocalIdentity,
    }),
    [clearLocalIdentity, currentUser, setLocalIdentity]
  );

  if (currentUser === undefined) {
    return (
      <main className="grid min-h-screen place-items-center bg-bg px-4 text-ink-soft">
        <p className="text-sm font-semibold">{t("loading.profile")}</p>
      </main>
    );
  }

  if ((currentUser === null && pathname !== "/welcome") || (currentUser && pathname === "/welcome")) {
    return (
      <main className="grid min-h-screen place-items-center bg-bg px-4 text-ink-soft">
        <p className="text-sm font-semibold">{t("loading.redirect")}</p>
      </main>
    );
  }

  return (
    <CurrentUserContext.Provider value={value}>
      {children}
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
