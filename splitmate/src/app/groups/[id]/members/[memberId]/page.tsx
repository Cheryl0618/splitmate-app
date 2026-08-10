import { notFound } from "next/navigation";

import { RelationshipPageClient } from "@/components/relationship-page-client";
import { getRelationshipPageData } from "@/server/relationships";

export default async function RelationshipPage({
  params,
}: {
  params: Promise<{ id: string; memberId: string }>;
}) {
  const { id, memberId } = await params;
  const target = getRelationshipPageData(id, memberId, "");
  if (!target) notFound();

  return <RelationshipPageClient groupId={id} memberId={memberId} />;
}
