import {
  deleteSettlement,
  SettlementMutationError,
} from "@/server/settlement-mutations";

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
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "撤销还款失败，请重试" }, { status: 500 });
  }
}
