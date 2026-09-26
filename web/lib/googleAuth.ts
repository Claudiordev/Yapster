import { createHash, randomBytes } from "node:crypto";

import { AUTH_COOKIE_OPTIONS } from "@/lib/constants";

/** Server-only helpers for the "Sign in with Google" redirect flow (authorization code + PKCE). */

export const GOOGLE_COOKIE_PATH = "/api/auth/google";
export const GOOGLE_COOKIES = ["g_state", "g_nonce", "g_verifier", "g_next"] as const;

/** The flow must finish within this many seconds. */
export const GOOGLE_FLOW_SECONDS = 600;

export const GOOGLE_COOKIE_OPTIONS = {
  ...AUTH_COOKIE_OPTIONS,
  path: GOOGLE_COOKIE_PATH,
  // Lax so the cookies come back on the top-level redirect from Google.
  sameSite: "lax" as const,
  maxAge: GOOGLE_FLOW_SECONDS,
};

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** PKCE S256 challenge for a verifier. */
export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/** Constant-time string comparison (state values are secrets of the flow). */
export function safeEqual(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false;

  let diff = 0;

  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);

  return diff === 0;
}

/**
 * The redirect URI Google sends the user back to. It must equal one registered in
 * Google Cloud AND one of session's `auth.google.redirect-uris`. Set
 * GOOGLE_REDIRECT_URI explicitly in production; otherwise it is built from the
 * request's public origin.
 */
export function googleRedirectUri(request: Request): string {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;

  return `${publicOrigin(request)}/api/auth/google/callback`;
}

/** The origin the browser used, even behind a reverse proxy. */
export function publicOrigin(request: Request): string {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? url.host;
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");

  return `${proto}://${host}`;
}

/** Only same-site relative paths may be used as the post-login destination. */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
