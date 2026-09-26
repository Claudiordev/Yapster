import { NextResponse } from "next/server";

import {
  GOOGLE_COOKIE_OPTIONS,
  googleRedirectUri,
  pkceChallenge,
  publicOrigin,
  randomToken,
  safeNext,
} from "@/lib/googleAuth";

/**
 * Starts "Sign in with Google": remembers a random state, nonce and PKCE verifier in
 * short-lived cookies, then sends the browser to Google. The callback checks them.
 */
export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const origin = publicOrigin(request);

  if (!clientId) {
    return NextResponse.redirect(`${origin}/login?error=google_unavailable`);
  }

  const state = randomToken();
  const nonce = randomToken();
  const verifier = randomToken(64); // 86 chars, within PKCE's 43-128
  const next = safeNext(new URL(request.url).searchParams.get("next"));

  const authorizeUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");

  authorizeUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(request),
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: pkceChallenge(verifier),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();

  const response = NextResponse.redirect(authorizeUrl.toString());

  response.cookies.set("g_state", state, GOOGLE_COOKIE_OPTIONS);
  response.cookies.set("g_nonce", nonce, GOOGLE_COOKIE_OPTIONS);
  response.cookies.set("g_verifier", verifier, GOOGLE_COOKIE_OPTIONS);
  response.cookies.set("g_next", next, GOOGLE_COOKIE_OPTIONS);

  return response;
}
