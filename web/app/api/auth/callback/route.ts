import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_OPTIONS,
  REFRESH_COOKIE_MAX_AGE_SECONDS,
  REFRESH_COOKIE_NAME,
} from "@/lib/constants";
import { publicOrigin, safeEqual, safeNext } from "@/lib/googleAuth";
import {
  KEYCLOAK_FLOW_COOKIES,
  exchangeCode,
  keycloakRedirectUri,
} from "@/lib/keycloak";

/** Back to the login page with an error key (the page maps it to a message). */
function loginError(origin: string, key: string) {
  const redirect = NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(key)}`);

  clearFlowCookies(redirect);

  return redirect;
}

function clearFlowCookies(response: NextResponse) {
  for (const name of KEYCLOAK_FLOW_COOKIES) {
    response.cookies.set(name, "", { path: "/api/auth", maxAge: 0 });
  }
}

/**
 * Keycloak sends the user back here with a code. We check the state we stored, swap the
 * code (+ PKCE verifier + client secret) for tokens, and set the same auth cookies the
 * rest of the app already reads.
 */
export async function GET(request: Request) {
  const origin = publicOrigin(request);
  const params = new URL(request.url).searchParams;
  const store = await cookies();
  const state = store.get("kc_state")?.value;
  const verifier = store.get("kc_verifier")?.value;
  const next = safeNext(store.get("kc_next")?.value);

  if (params.get("error")) return loginError(origin, "login_cancelled");

  const code = params.get("code");

  if (!code || !verifier || !safeEqual(state, params.get("state") ?? undefined)) {
    return loginError(origin, "login_state");
  }

  let tokens;

  try {
    tokens = await exchangeCode(code, verifier, keycloakRedirectUri(origin));
  } catch {
    return loginError(origin, "login_unavailable");
  }

  if (!tokens) return loginError(origin, "login_failed");

  const response = NextResponse.redirect(new URL(next, origin));

  response.cookies.set(AUTH_COOKIE_NAME, tokens.accessToken, {
    ...AUTH_COOKIE_OPTIONS,
    maxAge: tokens.accessExpiresInSeconds,
  });
  response.cookies.set(REFRESH_COOKIE_NAME, tokens.refreshToken, {
    ...AUTH_COOKIE_OPTIONS,
    maxAge: REFRESH_COOKIE_MAX_AGE_SECONDS,
  });
  clearFlowCookies(response);

  return response;
}
