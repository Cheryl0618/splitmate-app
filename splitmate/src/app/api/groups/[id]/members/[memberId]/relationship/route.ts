import { NextResponse } from "next/server";

import { getRelationshipPageData } from "@/server/relationships";
import { serverT } from "@/i18n/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id, memberId } = await params;
  const currentUserId = request.headers.get("x-demo-user-id")?.trim() ?? "";
  const data = getRelationshipPageData(id, memberId, currentUserId);
  if (!data) {
    return NextResponse.json({ error: serverT(request, "api.relationshipNotFound") }, { status: 404 });
  }
  return NextResponse.json(data);
}
