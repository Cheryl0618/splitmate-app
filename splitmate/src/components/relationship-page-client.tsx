"use client";

import { useEffect, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { RelationshipView } from "@/components/relationship-view";
import { useCurrentUser } from "@/lib/current-user";
import type { RelationshipPageData } from "@/server/relationships";
import { useT } from "@/i18n/context";

export function RelationshipPageClient({
  groupId,
  memberId,
}: {
  groupId: string;
  memberId: string;
}) {
  const { currentUserId } = useCurrentUser();
  const { locale, t } = useT();
  const [data, setData] = useState<RelationshipPageData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/groups/${groupId}/members/${memberId}/relationship`, {
      headers: { "x-demo-user-id": currentUserId, "x-ui-locale": locale },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Relationship request failed: ${response.status}`);
        setData((await response.json()) as RelationshipPageData);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          console.error("[RelationshipPageClient] failed", error);
          setFailed(true);
        }
      });
    return () => controller.abort();
  }, [currentUserId, groupId, locale, memberId]);

  if (failed) {
    return (
      <main className="min-h-screen bg-bg px-4 py-12">
        <div className="mx-auto max-w-3xl">
          <EmptyState
            title={t("relationship.loadError")}
            description={t("relationship.loadErrorDescription")}
            actionHref={`/groups/${groupId}`}
            actionLabel={t("relationship.backGroup")}
          />
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-bg px-4 py-12">
        <div className="mx-auto h-72 max-w-3xl animate-pulse rounded-[14px] bg-surface" aria-label={t("relationship.loading")} />
      </main>
    );
  }

  return <RelationshipView data={data} />;
}
