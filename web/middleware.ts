import { NextRequest, NextResponse } from "next/server";

import {
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_OPTIONS,
  PUBLIC_ROUTES,
  REFRESH_COOKIE_MAX_AGE_SECONDS,
  REFRESH_COOKIE_NAME,
  ROUTES,
} from "./lib/constants";
import { refreshWithKeycloak, verifyKeycloakToken } from "./lib/keycloak";

async function isTokenValid(token: string): Promise<boolean> {
  return (await verifyKeycloakToken(token)) !== null;
}

async function refreshAccessToken(refreshToken: string) {
  try {
    return await refreshWithKeycloak(refreshToken);
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
