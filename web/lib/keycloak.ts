import { createRemoteJWKSet, jwtVerify } from "jose";

import { AUTH_COOKIE_OPTIONS } from "./constants";
import type { AuthClaims, TokenPair } from "@/types/auth";

/**
 * Keycloak (OIDC) helpers. Edge-safe on purpose: the middleware imports this too,
 * so no Node-only modules here (PKCE and random tokens live in googleAuth.ts).
 */

// The realm URL as the BROWSER sees it. It must equal the `iss` Keycloak puts in tokens
// (KC_HOSTNAME + /realms/<realm>), otherwise verification fails.
export const KEYCLOAK_ISSUER =
  process.env.KEYCLOAK_ISSUER || "http://localhost:8180/realms/voxsi";
export const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || "voxsi-web";

const oidc = (endpoint: string) =>
  `${KEYCLOAK_ISSUER}/protocol/openid-connect/${endpoint}`;

export const KEYCLOAK_URLS = {
  authorize: oidc("auth"),
  registrations: oidc("registrations"),
  token: oidc("token"),
  logout: oidc("logout"),
  certs: oidc("certs"),
};

export const KEYCLOAK_FLOW_COOKIES = ["kc_state", "kc_verifier", "kc_next"] as const;

export const KEYCLOAK_FLOW_COOKIE_OPTIONS = {
  ...AUTH_COOKIE_OPTIONS,
  path: "/api/auth",
  maxAge: 600,
};

function clientSecret(): string {
  const secret = process.env.KEYCLOAK_WEB_CLIENT_SECRET;

  if (!secret) throw new Error("KEYCLOAK_WEB_CLIENT_SECRET is not configured");

  return secret;
}

/** The redirect URI registered on the `voxsi-web` client. */
export function keycloakRedirectUri(origin: string): string {
  return process.env.KEYCLOAK_REDIRECT_URI || `${origin}/api/auth/callback`;
}

// jose caches the keys and re-fetches the set when it sees an unknown `kid`.
const jwks = createRemoteJWKSet(new URL(KEYCLOAK_URLS.certs));

export async function verifyKeycloakToken(token: string): Promise<AuthClaims | null> {
  try {
    // No audience check: Keycloak access tokens carry `aud: account`, not the client id.
    const { payload } = await jwtVerify(token, jwks, {
      issuer: KEYCLOAK_ISSUER,
      algorithms: ["RS256"],
    });

    return payload as AuthClaims;
  } catch {
    return null;
  }
}

interface KeycloakTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number; // seconds
}

/** A rejected grant (bad/expired code or refresh token) is `null`; a network failure throws. */
async function tokenRequest(params: Record<string, string>): Promise<TokenPair | null> {
  const response = await fetch(KEYCLOAK_URLS.token, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: KEYCLOAK_CLIENT_ID,
      client_secret: clientSecret(),
      ...params,
    }),
    cache: "no-store",
  });

  if (!response.ok) return null;

  const data = (await response.json()) as KeycloakTokenResponse;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenType: data.token_type,
    accessExpiresInSeconds: Math.max(1, Math.floor(data.expires_in)),
  };
}

export function exchangeCode(
  code: string,
  verifier: string,
  redirectUri: string,
): Promise<TokenPair | null> {
  return tokenRequest({
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    redirect_uri: redirectUri,
  });
}

export function refreshWithKeycloak(refreshToken: string): Promise<TokenPair | null> {
  return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
}

/** Ends the Keycloak SSO session behind a refresh token, so the next login asks for credentials. */
export async function endKeycloakSession(refreshToken: string): Promise<void> {
  await fetch(KEYCLOAK_URLS.logout, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: KEYCLOAK_CLIENT_ID,
      client_secret: clientSecret(),
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  });
}
