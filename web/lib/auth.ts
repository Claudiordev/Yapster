import { cookies } from "next/headers";

import {
  API_BASE_URL,
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_OPTIONS,
  REFRESH_COOKIE_NAME,
} from "./constants";

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface RegisterResponse {
  userId: string;
}

export function decodeJwtPayload(
  token: string,
): { sub: string; role: string; exp: number } | null {
  try {
    const parts = token.split(".");

    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());

    return payload;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);

  if (!payload?.exp) return true;

  return payload.exp * 1000 <= Date.now();
}

export async function getAuthToken(): Promise<string | undefined> {
  const cookieStore = await cookies();

  const token:string | undefined = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (isTokenExpired(token ?? '')) {
    const refreshToken = await getRefreshToken();
    if (refreshToken !== undefined && refreshToken !== "") {
      const response = await refreshAccessToken(refreshToken);
      if (response) {
        await setAuthCookies(
            response.accessToken,
            response.refreshToken,
            response.expiresIn
        )

        return response.accessToken;
      }
    }
  }

  return cookieStore.get(AUTH_COOKIE_NAME)?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  const cookieStore = await cookies();

  return cookieStore.get(REFRESH_COOKIE_NAME)?.value;
}

export async function setAuthCookies(
  accessToken: string,
  refreshToken: string,
  accessExpiresInSeconds: number,
): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(AUTH_COOKIE_NAME, accessToken, {
    ...AUTH_COOKIE_OPTIONS,
    maxAge: accessExpiresInSeconds,
  });

  cookieStore.set(REFRESH_COOKIE_NAME, refreshToken, {
    ...AUTH_COOKIE_OPTIONS,
    maxAge: 7 * 24 * 60 * 60,
  });
}

export async function clearAuthCookies(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.delete(AUTH_COOKIE_NAME);
  cookieStore.delete(REFRESH_COOKIE_NAME);
}

export async function refreshAccessToken(
    refreshToken: string,
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
} | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return null;

    return response.json();
  } catch {
    return null;
  }
}
