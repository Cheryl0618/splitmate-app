"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { DEFAULT_DEMO_USER_ID } from "./demo-user";

interface CurrentUserContextValue {
  currentUserId: string;
  setCurrentUserId: (userId: string) => void;
}

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

export function CurrentUserProvider({
  children,
  initialUserId = DEFAULT_DEMO_USER_ID,
}: {
  children: ReactNode;
  initialUserId?: string;
}) {
  const [currentUserId, setCurrentUserId] = useState(initialUserId);
  const value = useMemo(
    () => ({ currentUserId, setCurrentUserId }),
    [currentUserId]
  );

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
