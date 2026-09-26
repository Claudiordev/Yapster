package com.claudiordese.session.infrastructure.security;

import com.claudiordese.exceptions.InvalidAuthorizationException;
import com.claudiordese.session.application.domain.GoogleIdentity;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class GoogleIdTokenValidatorTest {

    private static final String CLIENT_ID = "client-123.apps.googleusercontent.com";
    private static final Instant NOW = Instant.parse("2026-09-25T12:00:00Z");

    private final GoogleIdTokenValidator validator = new GoogleIdTokenValidator(new ObjectMapper(), CLIENT_ID);

    private static String token(String claimsJson) {
        Base64.Encoder enc = Base64.getUrlEncoder().withoutPadding();

        return enc.encodeToString("{\"alg\":\"RS256\"}".getBytes(StandardCharsets.UTF_8)) + "."
                + enc.encodeToString(claimsJson.getBytes(StandardCharsets.UTF_8)) + ".sig";
    }

    private static String claims(String iss, String aud, long exp, String nonce, String emailVerified) {
        return "{\"iss\":\"" + iss + "\",\"aud\":" + aud + ",\"exp\":" + exp + ",\"nonce\":\"" + nonce
                + "\",\"sub\":\"g-1\",\"email\":\"User@Gmail.com\",\"email_verified\":" + emailVerified
                + ",\"name\":\"User\"}";
    }

    private String good() {
        return token(claims("https://accounts.google.com", "\"" + CLIENT_ID + "\"", NOW.getEpochSecond() + 300, "n1", "true"));
    }

    @Test
    void acceptsAValidToken_andLowercasesTheEmail() {
        GoogleIdentity identity = validator.validate(good(), "n1", NOW);

        assertThat(identity.subject()).isEqualTo("g-1");
        assertThat(identity.email()).isEqualTo("user@gmail.com");
        assertThat(identity.emailVerified()).isTrue();
    }

    @Test
    void acceptsTheBareGoogleIssuerAndAnAudienceArray() {
        String t = token(claims("accounts.google.com", "[\"other\",\"" + CLIENT_ID + "\"]", NOW.getEpochSecond() + 300, "n1", "\"true\""));

        assertThat(validator.validate(t, "n1", NOW).emailVerified()).isTrue();
    }

    @Test
    void rejectsAWrongIssuer() {
        String t = token(claims("https://evil.example", "\"" + CLIENT_ID + "\"", NOW.getEpochSecond() + 300, "n1", "true"));

        assertThatThrownBy(() -> validator.validate(t, "n1", NOW)).isInstanceOf(InvalidAuthorizationException.class);
    }

    @Test
    void rejectsATokenForAnotherClient() {
        String t = token(claims("https://accounts.google.com", "\"someone-else\"", NOW.getEpochSecond() + 300, "n1", "true"));

        assertThatThrownBy(() -> validator.validate(t, "n1", NOW)).isInstanceOf(InvalidAuthorizationException.class);
    }

    @Test
    void rejectsAnExpiredToken_evenWithClockSkew() {
        String t = token(claims("https://accounts.google.com", "\"" + CLIENT_ID + "\"", NOW.getEpochSecond() - 120, "n1", "true"));

        assertThatThrownBy(() -> validator.validate(t, "n1", NOW)).isInstanceOf(InvalidAuthorizationException.class);
    }

    @Test
    void rejectsANonceMismatch() {
        assertThatThrownBy(() -> validator.validate(good(), "different", NOW)).isInstanceOf(InvalidAuthorizationException.class);
        assertThatThrownBy(() -> validator.validate(good(), null, NOW)).isInstanceOf(InvalidAuthorizationException.class);
    }

    @Test
    void reportsAnUnverifiedEmailAsUnverified() {
        String t = token(claims("https://accounts.google.com", "\"" + CLIENT_ID + "\"", NOW.getEpochSecond() + 300, "n1", "false"));

        assertThat(validator.validate(t, "n1", NOW).emailVerified()).isFalse();
    }

    @Test
    void rejectsMalformedTokens() {
        assertThatThrownBy(() -> validator.validate("not-a-jwt", "n1", NOW)).isInstanceOf(InvalidAuthorizationException.class);
        assertThatThrownBy(() -> validator.validate("a.!!!.c", "n1", NOW)).isInstanceOf(InvalidAuthorizationException.class);
    }
}
