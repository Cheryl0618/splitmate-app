import { GroupMutationError, updateGroup } from "@/server/group-mutations";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: unknown = await request.json().catch(() => null);
    const result = updateGroup(
      id,
      request.headers.get("x-demo-user-id")?.trim() ?? "",
      body
    );
    return Response.json(result);
  } catch (error) {
    if (error instanceof GroupMutationError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "保存群组设置失败，请重试" }, { status: 500 });
  }
}
