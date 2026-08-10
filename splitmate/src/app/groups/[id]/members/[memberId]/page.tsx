import { notFound } from "next/navigation";

import { RelationshipView } from "@/components/relationship-view";
import { getRelationshipPageData } from "@/server/relationships";

export default async function RelationshipPage({
  params,
}: {
  params: Promise<{ id: string; memberId: string }>;
}) {
  const { id, memberId } = await params;
  const data = getRelationshipPageData(id, memberId);
  if (!data) notFound();

  return <RelationshipView data={data} />;
}
