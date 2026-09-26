import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ApiError, apiPost } from "@/lib/apiClient";
import { AUTH_COOKIE_OPTIONS, AUTH_COOKIE_NAME, REFRESH_COOKIE_MAX_AGE_SECONDS, REFRESH_COOKIE_NAME } from "@/lib/constants";
import {
  GOOGLE_COOKIES,
  GOOGLE_COOKIE_PATH,
  googleRedirectUri,
  publicOrigin,
  safeEqual,
  safeNext,
} from "@/lib/googleAuth";
import { toTokenPair } from "@/lib/auth";
import type { SessionTokenResponse } from "@/types/auth";

/** Back to the login page with an error key (the page maps it to a message). */
function loginError(origin: string, key: string) {
  const redirect = NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(key)}`);

  clearFlowCookies(redirect);

  return redirect;
}

function clearFlowCookies(response: NextResponse) {
  for (const name of GOOGLE_COOKIES) {
    response.cookies.set(name, "", { path: GOOGLE_COOKIE_PATH, maxAge: 0 });
  }
}

/**
 * Google sends the user back here with a code. We check the state we stored, hand
 * the code + PKCE verifier + nonce to the session service (which talks to Google and
 * owns the client secret), then set the same auth cookies as a normal login.
 */
export async function GET(request: Request) {
  const origin = publicOrigin(request);
  const params = new URL(request.url).searchParams;
  const store = await cookies();
  const flow = {
    state: store.get("g_state")?.value,
    nonce: store.get("g_nonce")?.value,
    verifier: store.get("g_verifier")?.value,
    next: store.get("g_next")?.value,
  };

  if (params.get("error")) return loginError(origin, "google_cancelled");

  const code = params.get("code");

  if (!code || !safeEqual(params.get("state") ?? undefined, flow.state)) {
    return loginError(origin, "google_state");
  }
  if (!flow.verifier || !flow.nonce) return loginError(origin, "google_state");

  let tokens;

  try {
    const data = await apiPost<
      { code: string; redirectUri: string; codeVerifier: string; nonce: string },
      SessionTokenResponse
    >("/auth/google", {
      code,
      redirectUri: googleRedirectUri(request),
      codeVerifier: flow.verifier,
      nonce: flow.nonce,
    });

    tokens = toTokenPair(data);
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 409) return loginError(origin, "google_email_taken");
      if (error.status === 503) return loginError(origin, "google_unavailable");
    }

    return loginError(origin, "google_failed");
  }

  const response = NextResponse.redirect(`${origin}${safeNext(flow.next)}`);

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
