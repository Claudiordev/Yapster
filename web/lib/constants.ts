export const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8080";

export const AUTH_COOKIE_NAME = "auth-token";

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
