import { NextResponse } from "next/server";

import { apiPost, ApiError } from "@/lib/api-client";
import {
  clearAuthCookies,
  getRefreshToken,
  setAuthCookies,
  toTokenPair,
  type SessionTokenResponse,
} from "@/lib/auth";

export async function POST() {
  const refreshToken = await getRefreshToken();

  if (!refreshToken) {
    return NextResponse.json(
      { error: "No refresh token" },
      { status: 401 },
    );
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
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: "Failed to refresh token" },
      { status: 500 },
    );
  }
}
