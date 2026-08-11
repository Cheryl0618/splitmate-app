import { NextResponse } from "next/server";

import { DEFAULT_AVATAR_COLOR } from "@/lib/avatar-colors";
import {
  createSyncSession,
  EmailSyncError,
  registerDefaultUser,
  restoreByEmail,
  SYNC_SESSION_COOKIE,
} from "@/server/email-sync";
import {
  getPersonalSettings,
  initializeDefaultProfile,
  SettingsError,
} from "@/server/settings";
import { localizedError, serverT } from "@/i18n/server";

function responseWithSession(userId: string) {
  const response = NextResponse.json(getPersonalSettings(userId));
  response.cookies.set(SYNC_SESSION_COOKIE, createSyncSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      mode?: unknown;
      displayName?: unknown;
      email?: unknown;
      password?: unknown;
    };
    if (body.mode === "direct") {
      const profile = initializeDefaultProfile(
        body.displayName,
        DEFAULT_AVATAR_COLOR
      );
      return responseWithSession(profile.id);
    }
    if (body.mode === "register") {
      const result = await registerDefaultUser(
        body.displayName,
        body.email,
        body.password
      );
      return responseWithSession(result.userId);
    }
    if (body.mode === "login") {
      const result = await restoreByEmail(body.email, body.password);
      return responseWithSession(result.userId);
    }
    return NextResponse.json({ error: serverT(request, "api.chooseEntry") }, { status: 400 });
  } catch (error) {
    if (error instanceof EmailSyncError || error instanceof SettingsError) {
      return NextResponse.json({ error: localizedError(request, error.message, "welcome.genericError") }, { status: error.status });
    }
    console.error("[welcome] failed", error);
    return NextResponse.json(
      { error: serverT(request, "welcome.genericError") },
      { status: 500 }
    );
  }
}
