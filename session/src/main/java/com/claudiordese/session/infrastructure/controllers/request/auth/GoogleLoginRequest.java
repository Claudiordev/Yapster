package com.claudiordese.session.infrastructure.controllers.request.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** What the web app sends after Google redirects back with an authorization code. */
public record GoogleLoginRequest(
        @NotBlank @Size(max = 2048) String code,
        @NotBlank @Size(max = 512) String redirectUri,
        /** PKCE verifier generated when the sign-in started. */
        @NotBlank @Size(min = 43, max = 128) String codeVerifier,
        /** Nonce sent to Google at the start; must match the one in the ID token. */
        @NotBlank @Size(max = 256) String nonce) {
}
