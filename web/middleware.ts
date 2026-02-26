import { NextRequest, NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, PUBLIC_ROUTES, ROUTES } from "./lib/constants";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasToken = request.cookies.has(AUTH_COOKIE_NAME);

  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    pathname.startsWith(route),
  );

  if (!hasToken && !isPublicRoute) {
    const loginUrl = new URL(ROUTES.LOGIN, request.url);

    loginUrl.searchParams.set("callbackUrl", pathname);

    return NextResponse.redirect(loginUrl);
  }

  if (hasToken && isPublicRoute) {
    return NextResponse.redirect(new URL(ROUTES.HOME, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
