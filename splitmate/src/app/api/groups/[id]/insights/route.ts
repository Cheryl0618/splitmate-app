import { getGroupStats } from "@/server/group-stats";
import { getOrGenerateInsights } from "@/server/insights";

async function respond(
  params: Promise<{ id: string }>,
  force: boolean
) {
  const { id } = await params;
  const stats = getGroupStats(id);
  if (!stats) return Response.json({ insights: [] }, { status: 404 });
  if (stats.expenseCount === 0) return Response.json({ insights: [] });

  const result = await getOrGenerateInsights("group", id, stats, { force });
  return Response.json({ insights: result.insights });
}

export function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return respond(params, false);
}

export function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return respond(params, true);
}
