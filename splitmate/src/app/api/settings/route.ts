import { NextResponse } from "next/server";

import {
  getPersonalSettings,
  SettingsError,
  updateDisplayName,
} from "@/server/settings";

function userId(request: Request) {
  return request.headers.get("x-demo-user-id")?.trim() ?? "";
}

function failure(error: unknown) {
  if (error instanceof SettingsError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("[settings] failed", error);
  return NextResponse.json({ error: "保存失败，请稍后再试" }, { status: 500 });
}

export function GET(request: Request) {
  try {
    return NextResponse.json(getPersonalSettings(userId(request)));
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { displayName?: unknown };
    return NextResponse.json(updateDisplayName(userId(request), body.displayName));
  } catch (error) {
    return failure(error);
  }
}
