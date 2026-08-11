import {
  deleteSettlement,
  SettlementMutationError,
} from "@/server/settlement-mutations";
import { localizedError, serverT } from "@/i18n/server";

export async function DELETE(
  request: Request,
  {
    params,
  }: { params: Promise<{ id: string; settlementId: string }> }
) {
  try {
    const { id, settlementId } = await params;
    const result = deleteSettlement(
      id,
      settlementId,
      request.headers.get("x-demo-user-id")?.trim() ?? ""
    );
    return Response.json(result);
  } catch (error) {
    if (error instanceof SettlementMutationError) {
      return Response.json({ error: localizedError(request, error.message, "settle.undoError") }, { status: error.status });
    }
    return Response.json({ error: serverT(request, "settle.undoError") }, { status: 500 });
  }
}
