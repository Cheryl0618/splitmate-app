import {
  createSettlement,
  SettlementMutationError,
} from "@/server/settlement-mutations";
import { localizedError, serverT } from "@/i18n/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: unknown = await request.json().catch(() => null);
    const result = createSettlement(
      id,
      request.headers.get("x-demo-user-id")?.trim() ?? "",
      body
    );
    return Response.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof SettlementMutationError) {
      return Response.json({ error: localizedError(request, error.message, "settle.confirmError") }, { status: error.status });
    }
    return Response.json({ error: serverT(request, "settle.confirmError") }, { status: 500 });
  }
}
