import { NextResponse } from "next/server";

import { getRelationshipPageData } from "@/server/relationships";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id, memberId } = await params;
  const currentUserId = request.headers.get("x-demo-user-id")?.trim() ?? "";
  const data = getRelationshipPageData(id, memberId, currentUserId);
  if (!data) {
    return NextResponse.json({ error: "群组或成员不存在" }, { status: 404 });
  }
  return NextResponse.json(data);
}
