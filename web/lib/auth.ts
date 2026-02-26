import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME, AUTH_COOKIE_OPTIONS } from "./constants";

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiresInSeconds: string;
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

export async function getAuthToken(): Promise<string | undefined> {
  const cookieStore = await cookies();

  return cookieStore.get(AUTH_COOKIE_NAME)?.value;
}

export async function setAuthCookie(
  token: string,
  expiresInSeconds: number,
): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(AUTH_COOKIE_NAME, token, {
    ...AUTH_COOKIE_OPTIONS,
    maxAge: expiresInSeconds,
  });
}

export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.delete(AUTH_COOKIE_NAME);
}
