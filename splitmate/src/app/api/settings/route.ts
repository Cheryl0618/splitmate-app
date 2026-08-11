import { NextResponse } from "next/server";

import {
  getPersonalSettings,
  initializeDefaultProfile,
  SettingsError,
  updateProfile,
} from "@/server/settings";
import { localizedError, serverT } from "@/i18n/server";

function userId(request: Request) {
  return request.headers.get("x-demo-user-id")?.trim() ?? "";
}

function failure(request: Request, error: unknown) {
  if (error instanceof SettingsError) {
    return NextResponse.json({ error: localizedError(request, error.message, "settings.saveError") }, { status: error.status });
  }
  console.error("[settings] failed", error);
  return NextResponse.json({ error: serverT(request, "settings.saveError") }, { status: 500 });
}

export function GET(request: Request) {
  try {
    return NextResponse.json(getPersonalSettings(userId(request)));
  } catch (error) {
    return failure(request, error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      displayName?: unknown;
      avatarColor?: unknown;
    };
    return NextResponse.json(
      initializeDefaultProfile(body.displayName, body.avatarColor)
    );
  } catch (error) {
    return failure(request, error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      displayName?: unknown;
      avatarColor?: unknown;
    };
    return NextResponse.json(
      updateProfile(userId(request), body.displayName, body.avatarColor)
    );
  } catch (error) {
    return failure(request, error);
  }
}
