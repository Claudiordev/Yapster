export const API_BASE_URL =
  process.env.API_BASE_URL || "http://localhost:8080/api/v1";

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
export const JWT_PUBLIC_KEY =
  process.env.JWT_PUBLIC_KEY ||
  `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2iuA//Z5EypmPB0ddHuB
0dHwgnvM0XJ8R+h1hffyPEKdq7t+Ik9Wm2Qgh58AvFslpSU0laueXA/ftpfrXjBf
T+YgMs94IiBpvPeuhrJyEDbH2D/dspUDOjUfkvhvZobacQukWzdKrf7dAAH+BmJ2
QL/8zSsMgBpNWKbuW1h3pWQpPg0y30qgF7pAq3wrjoRlZwVF6nTm8gkDxAkEN5W6
ChMqVbJcUxxcB13k8rdCd/Ok9xWM2jP+DtRWNzsLfM9/jGBIOuAGe2Rce2jNPMWf
wPA/hP6qk8UXKYnzuSmJwivQnmHpnHYNJcZB2DhnO03kFsBeAeMx0WsjeeTywj6d
3QIDAQAB
-----END PUBLIC KEY-----`;
