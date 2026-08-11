import { NextResponse } from "next/server";

import { SYNC_SESSION_COOKIE } from "@/server/email-sync";
import { resetAllDemoData, SettingsError } from "@/server/settings";
import { localizedError, requestLocale, serverT } from "@/i18n/server";

export function POST(request: Request) {
  try {
    const userId = request.headers.get("x-demo-user-id")?.trim() ?? "";
    resetAllDemoData(userId, requestLocale(request));
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SYNC_SESSION_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    if (error instanceof SettingsError) {
      return NextResponse.json({ error: localizedError(request, error.message, "settings.resetError") }, { status: error.status });
    }
    console.error("[settings/reset] failed", error);
    return NextResponse.json(
      { error: serverT(request, "settings.resetError") },
      { status: 500 }
    );
  }
}
