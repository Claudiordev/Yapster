import { cookies } from "next/headers";

import {
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_OPTIONS,
  REFRESH_COOKIE_MAX_AGE_SECONDS,
  REFRESH_COOKIE_NAME,
} from "./constants";
import { refreshWithKeycloak, verifyKeycloakToken } from "./keycloak";
import type { AuthClaims, SessionTokenResponse, TokenPair } from "@/types/auth";

export function rolesFromClaims(claims: AuthClaims | null): string[] {
  if (!claims) return [];
  if (Array.isArray(claims.roles)) {
    return claims.roles.filter(
      (role): role is string => typeof role === "string",
    );
  }

  return typeof claims.role === "string" ? [claims.role] : [];
}

export function toTokenPair(response: SessionTokenResponse): TokenPair {
  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    tokenType: response.token_type,
    accessExpiresInSeconds: Math.max(1, Math.floor(response.expires_in)),
  };
}

export function verifyJwt(token: string): Promise<AuthClaims | null> {
  return verifyKeycloakToken(token);
}

export async function getAuthToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (token && (await verifyJwt(token))) {
    return token;
  }

  const refreshToken = cookieStore.get(REFRESH_COOKIE_NAME)?.value;

  if (!refreshToken) return undefined;

  const refreshed = await refreshAccessToken(refreshToken);

  if (!refreshed) return undefined;

  await setAuthCookies(refreshed);

  return refreshed.accessToken;
}

export async function getRefreshToken(): Promise<string | undefined> {
  const cookieStore = await cookies();

  return cookieStore.get(REFRESH_COOKIE_NAME)?.value;
}

export async function setAuthCookies(pair: TokenPair): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(AUTH_COOKIE_NAME, pair.accessToken, {
    ...AUTH_COOKIE_OPTIONS,
    maxAge: pair.accessExpiresInSeconds,
  });

  cookieStore.set(REFRESH_COOKIE_NAME, pair.refreshToken, {
    ...AUTH_COOKIE_OPTIONS,
    maxAge: REFRESH_COOKIE_MAX_AGE_SECONDS,
  });
}

export async function clearAuthCookies(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.delete(AUTH_COOKIE_NAME);
  cookieStore.delete(REFRESH_COOKIE_NAME);
}

/**
 * Keycloak can be set to rotate refresh tokens and revoke a token that is presented
 * twice. Several callers can refresh with the same cookie at once — parallel
 * BFF requests behind an expired access token, several tabs reacting to one
 * ROLES_CHANGED push — so the exchange is single-flight per refresh token:
 * concurrent callers share one backend call, and callers arriving within a
 * short window after it get the same result instead of a reuse error.
 * State lives on globalThis so route bundles share it.
 */
const REFRESH_REUSE_WINDOW_MS = 10_000;

interface RefreshFlight {
  promise: Promise<TokenPair | null>;
  settledAt: number | null;
}

const refreshFlights = ((globalThis as { __refreshFlights?: Map<string, RefreshFlight> })
  .__refreshFlights ??= new Map<string, RefreshFlight>());

function exchangeRefreshToken(refreshToken: string): Promise<TokenPair | null> {
  return refreshWithKeycloak(refreshToken);
}

export function refreshAccessToken(
  refreshToken: string,
): Promise<TokenPair | null> {
  const now = Date.now();

  refreshFlights.forEach((flight, key) => {
    if (flight.settledAt !== null && now - flight.settledAt > REFRESH_REUSE_WINDOW_MS) {
      refreshFlights.delete(key);
    }
  });

  const existing = refreshFlights.get(refreshToken);

  if (existing) return existing.promise;

  const flight: RefreshFlight = {
    settledAt: null,
    promise: exchangeRefreshToken(refreshToken).then(
      (pair) => {
        flight.settledAt = Date.now();
        // A failed exchange is not worth replaying to later callers.
        if (!pair) refreshFlights.delete(refreshToken);

        return pair;
      },
      (error) => {
        refreshFlights.delete(refreshToken);
        throw error;
      },
    ),
  };

  refreshFlights.set(refreshToken, flight);

  return flight.promise;
}
