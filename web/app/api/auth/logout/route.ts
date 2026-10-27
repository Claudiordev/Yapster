import { NextResponse } from "next/server";

import { clearAuthCookies, getRefreshToken } from "@/lib/auth";
import { endKeycloakSession } from "@/lib/keycloak";

export async function POST() {
  const refreshToken = await getRefreshToken();

  if (refreshToken) {
    try {
      await endKeycloakSession(refreshToken);
    } catch (error) {
      console.error("Failed to end the Keycloak session:", error);
    }
  }

  await clearAuthCookies();

  return NextResponse.json({ success: true });
}
