import { createGroup, GroupMutationError } from "@/server/group-mutations";
import { localizedError, serverT } from "@/i18n/server";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json().catch(() => null);
    const result = createGroup(
      request.headers.get("x-demo-user-id")?.trim() ?? "",
      body
    );
    return Response.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof GroupMutationError) {
      return Response.json({ error: localizedError(request, error.message, "group.saveError") }, { status: error.status });
    }
    return Response.json({ error: serverT(request, "group.saveError") }, { status: 500 });
  }
}
