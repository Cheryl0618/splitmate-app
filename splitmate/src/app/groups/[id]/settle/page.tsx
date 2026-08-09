import { notFound } from "next/navigation";

import { SettlementView } from "@/components/settlement-view";
import { getSettlementPageData } from "@/server/settlements";

export default async function SettlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = getSettlementPageData(id);
  if (!data) notFound();

  return <SettlementView data={data} />;
}
