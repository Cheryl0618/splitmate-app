import {
  addGroupMembers,
  GroupMutationError,
} from "@/server/group-mutations";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: unknown = await request.json().catch(() => null);
    const result = addGroupMembers(
      id,
      request.headers.get("x-demo-user-id")?.trim() ?? "",
      body
    );
    return Response.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof GroupMutationError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "添加成员失败，请重试" }, { status: 500 });
  }
}
