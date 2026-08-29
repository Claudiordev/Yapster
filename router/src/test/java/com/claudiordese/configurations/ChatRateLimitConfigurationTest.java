package com.claudiordese.configurations;

import static org.assertj.core.api.Assertions.assertThat;

import java.security.KeyPair;
import java.security.KeyPairGenerator;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import io.jsonwebtoken.JwtParser;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;

class ChatRateLimitConfigurationTest {

    private static KeyPair trustedKeys;
    private static JwtParser parser;

    @BeforeAll
    static void createKeys() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        trustedKeys = generator.generateKeyPair();
        parser = Jwts.parserBuilder().setSigningKey(trustedKeys.getPublic()).build();
    }

    @Test
    void usesVerifiedJwtSubjectAsTheBucketKey() {
        String token = Jwts.builder()
                .setSubject("user-123")
                .signWith(trustedKeys.getPrivate(), SignatureAlgorithm.RS256)
                .compact();

        assertThat(ChatRateLimitConfiguration.resolveKey("Bearer " + token, parser))
                .isEqualTo("chat:user:user-123");
    }

    @Test
    void invalidTokensCannotChooseTheirOwnBucket() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        KeyPair untrustedKeys = generator.generateKeyPair();
        String token = Jwts.builder()
                .setSubject("forged-user")
                .signWith(untrustedKeys.getPrivate(), SignatureAlgorithm.RS256)
                .compact();

        assertThat(ChatRateLimitConfiguration.resolveKey("Bearer " + token, parser))
                .isEqualTo(ChatRateLimitConfiguration.UNAUTHENTICATED_KEY);
    }

    @Test
    void missingTokensShareTheUnauthenticatedBucket() {
        assertThat(ChatRateLimitConfiguration.resolveKey(null, parser))
                .isEqualTo(ChatRateLimitConfiguration.UNAUTHENTICATED_KEY);
        assertThat(ChatRateLimitConfiguration.resolveKey("Bearer ", parser))
                .isEqualTo(ChatRateLimitConfiguration.UNAUTHENTICATED_KEY);
    }
}
