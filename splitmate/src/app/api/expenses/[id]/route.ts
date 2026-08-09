import {
  deleteExpense,
  ExpenseMutationError,
  updateExpense,
} from "@/server/expense-mutations";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: unknown = await request.json().catch(() => null);
    const result = updateExpense(
      id,
      request.headers.get("x-demo-user-id")?.trim() ?? "",
      body
    );
    return Response.json(result);
  } catch (error) {
    if (error instanceof ExpenseMutationError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "保存账单失败，请重试" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = deleteExpense(
      id,
      request.headers.get("x-demo-user-id")?.trim() ?? ""
    );
    return Response.json(result);
  } catch (error) {
    if (error instanceof ExpenseMutationError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "删除账单失败，请重试" }, { status: 500 });
  }
}
