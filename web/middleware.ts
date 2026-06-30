import { NextRequest, NextResponse } from "next/server";
import { importSPKI, jwtVerify } from "jose";

import {
  API_BASE_URL,
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_OPTIONS,
  JWT_PUBLIC_KEY,
  PUBLIC_ROUTES,
  REFRESH_COOKIE_MAX_AGE_SECONDS,
  REFRESH_COOKIE_NAME,
  ROUTES,
} from "./lib/constants";

const JWT_ALG = "RS256";

let cachedKey: Promise<CryptoKey> | null = null;

function getPublicKey(): Promise<CryptoKey> {
  if (!cachedKey) {
    if (!JWT_PUBLIC_KEY) {
      throw new Error("JWT_PUBLIC_KEY is not configured");
    }
    cachedKey = importSPKI(JWT_PUBLIC_KEY, JWT_ALG);
  }

  return cachedKey;
}

async function isTokenValid(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, await getPublicKey(), { algorithms: [JWT_ALG] });

    return true;
  } catch {
    return false;
  }
}

interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  accessExpiresInSeconds: number;
}

async function refreshAccessToken(
  refreshToken: string,
): Promise<RefreshResult | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      accessExpiresInSeconds: Math.max(1, Math.floor(data.expires_in / 1000)),
    };
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

  let hasValidToken = token != null && (await isTokenValid(token));

  if (!hasValidToken && refreshToken) {
    const refreshed = await refreshAccessToken(refreshToken);

    if (refreshed) {
      hasValidToken = true;

      const response = isPublicRoute
        ? NextResponse.redirect(new URL(ROUTES.HOME, request.url))
        : NextResponse.next();

      response.cookies.set(AUTH_COOKIE_NAME, refreshed.accessToken, {
        ...AUTH_COOKIE_OPTIONS,
        maxAge: refreshed.accessExpiresInSeconds,
      });
      response.cookies.set(REFRESH_COOKIE_NAME, refreshed.refreshToken, {
        ...AUTH_COOKIE_OPTIONS,
        maxAge: REFRESH_COOKIE_MAX_AGE_SECONDS,
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
