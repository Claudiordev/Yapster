import { NextResponse } from "next/server";

import { apiPost, ApiError } from "@/lib/api-client";
import {
  clearAuthCookies,
  getRefreshToken,
  setAuthCookies,
  toTokenPair,
  type SessionTokenResponse,
} from "@/lib/auth";
import { apiErrorResponse, problemResponse } from "@/lib/problem-response";

export async function POST(request: Request) {
  const refreshToken = await getRefreshToken();

  if (!refreshToken) {
    return problemResponse(request, 401, "No refresh token", "Unauthorized");
  }

  try {
    const data = await apiPost<{ refreshToken: string }, SessionTokenResponse>(
      "/auth/refresh",
      { refreshToken },
    );

    await setAuthCookies(toTokenPair(data));

    return NextResponse.json({ success: true });
  } catch (error) {
    await clearAuthCookies();

    if (error instanceof ApiError) {
      return apiErrorResponse(request, error);
    }

    return problemResponse(request, 500, "Failed to refresh token");
  }
}
