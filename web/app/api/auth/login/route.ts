import { NextResponse } from "next/server";

import {
  KEYCLOAK_CLIENT_ID,
  KEYCLOAK_FLOW_COOKIE_OPTIONS,
  KEYCLOAK_URLS,
  keycloakRedirectUri,
} from "@/lib/keycloak";
import { pkceChallenge, publicOrigin, randomToken, safeNext } from "@/lib/googleAuth";

/**
 * Starts the Keycloak login: remembers a random state, the PKCE verifier and where to
 * land afterwards in short-lived cookies, then sends the browser to Keycloak.
 * `?mode=register` opens Keycloak's registration form; `?idp=google` skips Keycloak's
 * login page and goes straight to the Google identity provider.
 */
export async function GET(request: Request) {
  const origin = publicOrigin(request);
  const params = new URL(request.url).searchParams;

  const state = randomToken();
  const verifier = randomToken(64); // 86 chars, within PKCE's 43-128
  const next = safeNext(params.get("next"));

  const authorizeUrl = new URL(
    params.get("mode") === "register"
      ? KEYCLOAK_URLS.registrations
      : KEYCLOAK_URLS.authorize,
  );

  authorizeUrl.search = new URLSearchParams({
    client_id: KEYCLOAK_CLIENT_ID,
    redirect_uri: keycloakRedirectUri(origin),
    response_type: "code",
    scope: "openid",
    state,
    code_challenge: pkceChallenge(verifier),
    code_challenge_method: "S256",
    ...(params.get("idp") === "google" ? { kc_idp_hint: "google" } : {}),
  }).toString();

  const response = NextResponse.redirect(authorizeUrl.toString());

  response.cookies.set("kc_state", state, KEYCLOAK_FLOW_COOKIE_OPTIONS);
  response.cookies.set("kc_verifier", verifier, KEYCLOAK_FLOW_COOKIE_OPTIONS);
  response.cookies.set("kc_next", next, KEYCLOAK_FLOW_COOKIE_OPTIONS);

  return response;
}
