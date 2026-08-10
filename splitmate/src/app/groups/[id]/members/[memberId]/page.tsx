import { notFound } from "next/navigation";

import { RelationshipView } from "@/components/relationship-view";
import { getCurrentUserId } from "@/server/current-user";
import { getRelationshipPageData } from "@/server/relationships";

export default async function RelationshipPage({
  params,
}: {
  params: Promise<{ id: string; memberId: string }>;
}) {
  const { id, memberId } = await params;
  const currentUserId = await getCurrentUserId();
  const data = getRelationshipPageData(id, memberId, currentUserId);
  if (!data) notFound();

  return <RelationshipView data={data} />;
}
