"use client";

import { useCurrentUser } from "@/lib/current-user";

export function PerspectiveName({
  userId,
  displayName,
}: {
  userId: string | null;
  displayName: string;
}) {
  const { currentUserId } = useCurrentUser();
  return <>{userId === currentUserId ? "你" : displayName}</>;
}

export function PerspectiveInitial({
  userId,
  displayName,
}: {
  userId: string | null;
  displayName: string;
}) {
  const { currentUserId } = useCurrentUser();
  return <>{(userId === currentUserId ? "你" : displayName).slice(0, 1).toUpperCase()}</>;
}
