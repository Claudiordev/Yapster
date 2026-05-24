import { NextResponse } from "next/server";

import { apiPost } from "@/lib/api-client";
import { clearAuthCookies, getRefreshToken } from "@/lib/auth";

export async function POST() {
  const refreshToken = await getRefreshToken();

  if (refreshToken) {
    try {
      await apiPost("/auth/logout", { refreshToken });
    } catch (error) {
      console.error("Failed to revoke refresh token on backend:", error);
    }
  }

  await clearAuthCookies();

  return NextResponse.json({ success: true });
}
