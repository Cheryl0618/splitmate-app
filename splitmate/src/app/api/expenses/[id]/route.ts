import {
  deleteExpense,
  ExpenseMutationError,
  updateExpense,
} from "@/server/expense-mutations";
import { localizedError, serverT } from "@/i18n/server";

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
      return Response.json({ error: localizedError(request, error.message, "expense.saveError") }, { status: error.status });
    }
    return Response.json({ error: serverT(request, "expense.saveError") }, { status: 500 });
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
      return Response.json({ error: localizedError(request, error.message, "expense.deleteError") }, { status: error.status });
    }
    return Response.json({ error: serverT(request, "expense.deleteError") }, { status: 500 });
  }
}
