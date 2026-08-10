"use client";

import { useEffect, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { RelationshipView } from "@/components/relationship-view";
import { useCurrentUser } from "@/lib/current-user";
import type { RelationshipPageData } from "@/server/relationships";

export function RelationshipPageClient({
  groupId,
  memberId,
}: {
  groupId: string;
  memberId: string;
}) {
  const { currentUserId } = useCurrentUser();
  const [data, setData] = useState<RelationshipPageData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/groups/${groupId}/members/${memberId}/relationship`, {
      headers: { "x-demo-user-id": currentUserId },
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
  }, [currentUserId, groupId, memberId]);

  if (failed) {
    return (
      <main className="min-h-screen bg-[#f6f8f7] px-4 py-12">
        <div className="mx-auto max-w-3xl">
          <EmptyState
            title="关系画像暂时无法加载"
            description="返回群组后可以继续查看账单，稍后再打开关系画像。"
            actionHref={`/groups/${groupId}`}
            actionLabel="返回群组"
          />
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-[#f6f8f7] px-4 py-12">
        <div className="mx-auto h-72 max-w-3xl animate-pulse rounded-3xl bg-white" aria-label="正在加载关系画像" />
      </main>
    );
  }

  return <RelationshipView data={data} />;
}
