import { getGroupStats } from "@/server/group-stats";
import { getOrGenerateInsights } from "@/server/insights";
import { requestLocale } from "@/i18n/server";

async function respond(
  request: Request,
  params: Promise<{ id: string }>,
  force: boolean
) {
  const { id } = await params;
  const stats = getGroupStats(id);
  if (!stats) return Response.json({ insights: [] }, { status: 404 });
  if (stats.expenseCount === 0) return Response.json({ insights: [] });

  const result = await getOrGenerateInsights("group", id, stats, { force, locale: requestLocale(request) });
  return Response.json({ insights: result.insights });
}

export function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return respond(request, params, false);
}

export function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return respond(request, params, true);
}
