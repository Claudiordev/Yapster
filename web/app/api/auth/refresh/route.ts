import { NextResponse } from "next/server";

import { apiPost, ApiError } from "@/lib/api-client";
import { getRefreshToken, setAuthCookies, clearAuthCookies } from "@/lib/auth";
import type { LoginResponse } from "@/lib/auth";

export async function POST() {
  const refreshToken = await getRefreshToken();

  if (!refreshToken) {
    return NextResponse.json(
      { error: "No refresh token" },
      { status: 401 },
    );
  }

  try {
    const data = await apiPost<{ refreshToken: string }, LoginResponse>(
      "/auth/refresh",
      { refreshToken },
    );

    await setAuthCookies(
      data.accessToken,
      data.refreshToken,
      data.expiresIn,
    );

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
