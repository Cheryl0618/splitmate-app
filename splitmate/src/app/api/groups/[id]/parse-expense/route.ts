import { parseExpense, type ParseExpenseInput } from "@/lib/parse-expense";
import { getExpenseFormGroup } from "@/server/expenses";

function isParseInput(value: unknown): value is ParseExpenseInput {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return (
    (input.type === "image" || input.type === "text") &&
    typeof input.data === "string" &&
    input.data.trim().length > 0
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const group = getExpenseFormGroup(id);
  if (!group) return Response.json({ error: "群组不存在" }, { status: 404 });

  const input: unknown = await request.json().catch(() => null);
  if (!isParseInput(input)) {
    return Response.json({ error: "解析内容不能为空" }, { status: 400 });
  }

  const currentUserId = request.headers.get("x-demo-user-id")?.trim() ?? "";
  const parsed = await parseExpense(
    input,
    group.members.map(({ id: memberId, userId, displayName }) => ({
      id: memberId,
      displayName,
      isCurrentUser: userId === currentUserId,
    }))
  );
  return Response.json(parsed);
}
