import { GroupMutationError, updateGroup } from "@/server/group-mutations";
import { localizedError, serverT } from "@/i18n/server";

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
      return Response.json({ error: localizedError(request, error.message, "group.saveError") }, { status: error.status });
    }
    return Response.json({ error: serverT(request, "group.saveError") }, { status: 500 });
  }
}
