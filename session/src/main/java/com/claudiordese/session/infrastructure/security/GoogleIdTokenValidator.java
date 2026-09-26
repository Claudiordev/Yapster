package com.claudiordese.session.infrastructure.security;

import com.claudiordese.exceptions.InvalidAuthorizationException;
import com.claudiordese.session.application.domain.GoogleIdentity;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.Base64;
import java.util.Set;

/**
 * Validates the claims of a Google ID token.
 *
 * The signature is NOT checked here on purpose: the token is only ever obtained by
 * exchanging an authorization code directly with Google's token endpoint over TLS
 * (with our client secret and the PKCE verifier), which OpenID Connect Core §3.1.3.7
 * allows in place of signature validation. Never pass this a token that came from the
 * browser. Checked: issuer, audience (our client id), expiry, nonce, and that Google
 * reports the email as verified.
 */
public class GoogleIdTokenValidator {

    private static final Set<String> ISSUERS = Set.of("https://accounts.google.com", "accounts.google.com");
    private static final long CLOCK_SKEW_SECONDS = 60;

    private final ObjectMapper json;
    private final String clientId;

    public GoogleIdTokenValidator(ObjectMapper json, String clientId) {
        this.json = json;
        this.clientId = clientId;
    }

    public GoogleIdentity validate(String idToken, String expectedNonce, Instant now) {
        JsonNode claims = claimsOf(idToken);

        if (!ISSUERS.contains(claims.path("iss").asText(""))) throw invalid("wrong issuer");
        if (!audienceMatches(claims.path("aud"))) throw invalid("wrong audience");
        if (claims.path("exp").asLong(0) + CLOCK_SKEW_SECONDS < now.getEpochSecond()) throw invalid("token expired");
        if (expectedNonce == null || !expectedNonce.equals(claims.path("nonce").asText(null))) throw invalid("nonce mismatch");

        String subject = claims.path("sub").asText("");
        String email = claims.path("email").asText("");

        if (subject.isBlank() || email.isBlank()) throw invalid("missing subject or email");

        // Google sends a boolean, but some tokens carry the string "true".
        JsonNode verified = claims.path("email_verified");
        boolean emailVerified = verified.isBoolean() ? verified.asBoolean() : "true".equals(verified.asText(""));

        return new GoogleIdentity(subject, email.toLowerCase(), emailVerified,
                claims.path("name").asText(null), claims.path("picture").asText(null));
    }

    private boolean audienceMatches(JsonNode aud) {
        if (aud.isArray()) {
            for (JsonNode a : aud) if (clientId.equals(a.asText())) return true;
            return false;
        }
        return clientId.equals(aud.asText(""));
    }

    private JsonNode claimsOf(String idToken) {
        try {
            String[] parts = idToken.split("\\.");

            if (parts.length < 2) throw invalid("malformed token");
            return json.readTree(Base64.getUrlDecoder().decode(parts[1]));
        } catch (InvalidAuthorizationException e) {
            throw e;
        } catch (Exception e) {
            throw invalid("unreadable token");
        }
    }

    private static InvalidAuthorizationException invalid(String reason) {
        return new InvalidAuthorizationException("google_token_invalid", "Google sign-in failed (" + reason + ")");
    }
}
