import { cookies } from "next/headers";
import { importSPKI, jwtVerify, type JWTPayload } from "jose";

import { apiPost, ApiError } from "./api-client";
import {
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_OPTIONS,
  JWT_PUBLIC_KEY,
  REFRESH_COOKIE_MAX_AGE_SECONDS,
  REFRESH_COOKIE_NAME,
} from "./constants";

const JWT_ALG = "RS256";

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  confirmEmail: string;
  password: string;
}

// Wire format returned by the session service (snake_case via @JsonProperty).
export interface SessionTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number; // milliseconds
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  // Seconds until the access token expires — already converted from the
  // backend's millisecond representation.
  accessExpiresInSeconds: number;
}

export interface SessionRegisterResponse {
  id: string;
  username: string;
}

export interface AuthClaims extends JWTPayload {
  sub: string;
  role?: string;
}

export function toTokenPair(response: SessionTokenResponse): TokenPair {
  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    tokenType: response.token_type,
    accessExpiresInSeconds: Math.max(1, Math.floor(response.expires_in / 1000)),
  };
}

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

export async function verifyJwt(token: string): Promise<AuthClaims | null> {
  try {
    const { payload } = await jwtVerify(token, await getPublicKey(), {
      algorithms: [JWT_ALG],
    });

    return payload as AuthClaims;
  } catch {
    return null;
  }
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

export async function refreshAccessToken(
  refreshToken: string,
): Promise<TokenPair | null> {
  try {
    const data = await apiPost<{ refreshToken: string }, SessionTokenResponse>(
      "/auth/refresh",
      { refreshToken },
    );

    return toTokenPair(data);
  } catch (error) {
    if (error instanceof ApiError) return null;
    throw error;
  }
}
