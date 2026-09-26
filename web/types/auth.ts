import type { JWTPayload } from "jose";

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
  expires_in: number; // seconds until the access token expires (OAuth standard)
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  // Seconds until the access token expires (as sent by the backend).
  accessExpiresInSeconds: number;
}

export interface SessionRegisterResponse {
  id: string;
  username: string;
}

export interface AuthClaims extends JWTPayload {
  sub: string;
  roles?: string[];
  /** Backward compatibility for tokens issued before roles became a list. */
  role?: string;
}
