import { NextRequest, NextResponse } from "next/server";

import {
  AUTH_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  PUBLIC_ROUTES,
  ROUTES,
  API_BASE_URL,
  AUTH_COOKIE_OPTIONS,
} from "./lib/constants";

function isTokenValid(token: string): boolean {
  try {
    const parts = token.split(".");

    if (parts.length !== 3) return false;

    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString(),
    );

    if (!payload.exp) return false;

    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

async function refreshAccessToken(
  refreshToken: string,
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
} | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return null;

    return response.json();
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value;

  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    pathname.startsWith(route),
  );

  let hasValidToken = token != null && isTokenValid(token);

  // Attempt refresh if access token is missing/expired but refresh token exists
  if (!hasValidToken && refreshToken) {
    const refreshed = await refreshAccessToken(refreshToken);

    if (refreshed) {
      hasValidToken = true;

      const response = isPublicRoute
        ? NextResponse.redirect(new URL(ROUTES.HOME, request.url))
        : NextResponse.next();

      response.cookies.set(AUTH_COOKIE_NAME, refreshed.accessToken, {
        ...AUTH_COOKIE_OPTIONS,
        maxAge: refreshed.expiresIn,
      });
      response.cookies.set(REFRESH_COOKIE_NAME, refreshed.refreshToken, {
        ...AUTH_COOKIE_OPTIONS,
        maxAge: 7 * 24 * 60 * 60,
      });

      return response;
    }
  }

  if (!hasValidToken && !isPublicRoute) {
    const response = NextResponse.redirect(
      new URL(`${ROUTES.LOGIN}?callbackUrl=${pathname}`, request.url),
    );

    response.cookies.delete(AUTH_COOKIE_NAME);
    response.cookies.delete(REFRESH_COOKIE_NAME);

    return response;
  }

  if (hasValidToken && isPublicRoute) {
    return NextResponse.redirect(new URL(ROUTES.HOME, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
