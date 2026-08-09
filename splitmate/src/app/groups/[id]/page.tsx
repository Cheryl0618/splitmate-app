import { notFound } from "next/navigation";

import { GroupDetailView } from "@/components/group-detail-view";
import { getGroupDetail } from "@/server/group-details";

export default async function GroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const group = getGroupDetail(id);
  if (!group) notFound();

  return <GroupDetailView group={group} />;
}
