"use client";

import { useCurrentUser } from "@/lib/current-user";
import { avatarColorClass } from "@/lib/avatar-colors";
import { useT } from "@/i18n/context";

export function PerspectiveName({
  userId,
  displayName,
}: {
  userId: string | null;
  displayName: string;
}) {
  const { currentUserId } = useCurrentUser();
  const { t } = useT();
  return <>{userId === currentUserId ? t("common.you") : displayName}</>;
}

export function PerspectiveAvatar({
  userId,
  displayName,
}: {
  userId: string | null;
  displayName: string;
}) {
  const { currentUserId, currentUser } = useCurrentUser();
  const { t } = useT();
  const isCurrent = userId === currentUserId;
  return (
    <span
      className={`grid h-9 w-9 place-items-center rounded-full text-xs font-bold ${
        isCurrent
          ? avatarColorClass(currentUser?.avatarColor)
          : "bg-inset text-ink-soft"
      }`}
    >
      {(isCurrent ? t("common.you") : displayName).slice(0, 1).toUpperCase()}
    </span>
  );
}
