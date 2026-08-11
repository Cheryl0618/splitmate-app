import { NextResponse } from "next/server";

import {
  bindEmail,
  createSyncSession,
  EmailSyncError,
  SYNC_SESSION_COOKIE,
  unbindEmail,
} from "@/server/email-sync";
import { localizedError, serverT } from "@/i18n/server";

function failure(request: Request, error: unknown) {
  if (error instanceof EmailSyncError) {
    return NextResponse.json({ error: localizedError(request, error.message, "settings.syncError") }, { status: error.status });
  }
  console.error("[email-sync] failed", error);
  return NextResponse.json({ error: serverT(request, "settings.syncError") }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const userId = request.headers.get("x-demo-user-id")?.trim() ?? "";
    const body = (await request.json()) as { email?: unknown; password?: unknown };
    const result = await bindEmail(userId, body.email, body.password);
    const response = NextResponse.json({ email: result.email });
    response.cookies.set(SYNC_SESSION_COOKIE, createSyncSession(userId), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (error) {
    return failure(request, error);
  }
}

export function DELETE(request: Request) {
  try {
    const userId = request.headers.get("x-demo-user-id")?.trim() ?? "";
    unbindEmail(userId);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SYNC_SESSION_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    return failure(request, error);
  }
}
