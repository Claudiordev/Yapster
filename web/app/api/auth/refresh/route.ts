import { NextResponse } from "next/server";

import {
  clearAuthCookies,
  getRefreshToken,
  refreshAccessToken,
  setAuthCookies,
} from "@/lib/auth";
import { problemResponse } from "@/lib/problemResponse";

/**
 * Exchanges the refresh cookie for a new token pair. Goes through the shared
 * single-flight in `refreshAccessToken` so it can't race other refreshes of
 * the same token. A "soft" caller (the realtime role sync) keeps the session
 * cookies on failure — only a hard failure from an explicit refresh clears them.
 */
export async function POST(request: Request) {
  const soft = request.headers.get("x-soft-refresh") === "1";
  const refreshToken = await getRefreshToken();

  if (!refreshToken) {
    return problemResponse(request, 401, "No refresh token", "Unauthorized");
  }

  let pair;

  try {
    pair = await refreshAccessToken(refreshToken);
  } catch {
    return problemResponse(request, 500, "Failed to refresh token");
  }

  if (!pair) {
    if (!soft) await clearAuthCookies();

    return problemResponse(request, 401, "Failed to refresh token", "Unauthorized");
  }

  await setAuthCookies(pair);

  return NextResponse.json({ success: true });
}
