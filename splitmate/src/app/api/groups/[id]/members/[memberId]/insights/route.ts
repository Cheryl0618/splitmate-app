import { getOrGenerateInsights } from "@/server/insights";
import { getRelationshipInsightStats } from "@/server/relationship-stats";

async function respond(
  request: Request,
  params: Promise<{ id: string; memberId: string }>,
  force: boolean
) {
  const { id, memberId } = await params;
  const currentUserId = request.headers.get("x-demo-user-id")?.trim() ?? "";
  const result = getRelationshipInsightStats(id, memberId, currentUserId);
  if (!result || result.stats.sharedExpenseCount === 0) {
    return Response.json({ insights: [] }, { status: 404 });
  }

  const cached = await getOrGenerateInsights(
    "relationship",
    result.scopeId,
    result.stats,
    { force }
  );
  return Response.json({ insights: cached.insights });
}

export function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  return respond(request, params, false);
}

export function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  return respond(request, params, true);
}
