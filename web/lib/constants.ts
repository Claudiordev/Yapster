export const API_BASE_URL =
  process.env.API_BASE_URL || "http://localhost:8080";

export const AUTH_COOKIE_NAME = "auth-token";
export const REFRESH_COOKIE_NAME = "refresh-token";

export const REFRESH_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export const ROUTES = {
  LOGIN: "/login",
  REGISTER: "/register",
  HOME: "/",
} as const;

export const PUBLIC_ROUTES = [ROUTES.LOGIN, ROUTES.REGISTER];

// PEM-encoded RS256 public key used to verify JWTs minted by the session service.
// Defaults to the dev keypair shipped in session/src/main/resources/keys/public.pem.
export const JWT_PUBLIC_KEY = process.env.JWT_PUBLIC_KEY;
