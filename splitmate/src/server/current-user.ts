import { headers } from "next/headers";

import { DEFAULT_DEMO_USER_ID } from "@/lib/demo-user";

export async function getCurrentUserId() {
  const userId = (await headers()).get("x-demo-user-id")?.trim();
  return userId || DEFAULT_DEMO_USER_ID;
}
