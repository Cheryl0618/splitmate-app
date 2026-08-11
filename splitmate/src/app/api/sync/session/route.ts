import { NextResponse } from "next/server";

import {
  createSyncSession,
  EmailSyncError,
  restoreByEmail,
  SYNC_SESSION_COOKIE,
} from "@/server/email-sync";
import { localizedError, serverT } from "@/i18n/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: unknown; password?: unknown };
    const result = await restoreByEmail(body.email, body.password);
    const response = NextResponse.json(result);
    response.cookies.set(SYNC_SESSION_COOKIE, createSyncSession(result.userId), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (error) {
    if (error instanceof EmailSyncError) {
      return NextResponse.json({ error: localizedError(request, error.message, "api.restoreError") }, { status: error.status });
    }
    console.error("[email-restore] failed", error);
    return NextResponse.json({ error: serverT(request, "api.restoreError") }, { status: 500 });
  }
}

export function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SYNC_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
