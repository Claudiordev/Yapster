package com.claudiordese.configurations;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.http.HttpHeaders;

import io.jsonwebtoken.JwtParser;
import io.jsonwebtoken.Jwts;
import reactor.core.publisher.Mono;

@Configuration
public class ChatRateLimitConfiguration {

    static final String UNAUTHENTICATED_KEY = "chat:unauthenticated";

    private static final Logger logger = LoggerFactory.getLogger(ChatRateLimitConfiguration.class);

    @Bean
    JwtParser chatRateLimitJwtParser(
            ResourceLoader resourceLoader,
            @Value("${security.jwt.public-key-path:classpath:keys/public.pem}") String publicKeyPath) {
        try {
            Resource resource = resourceLoader.getResource(publicKeyPath);
            try (InputStream input = resource.getInputStream()) {
                String pem = new String(input.readAllBytes(), StandardCharsets.UTF_8)
                        .replace("-----BEGIN PUBLIC KEY-----", "")
                        .replace("-----END PUBLIC KEY-----", "")
                        .replaceAll("\\s", "");
                byte[] keyBytes = Base64.getDecoder().decode(pem);
                PublicKey publicKey = KeyFactory.getInstance("RSA")
                        .generatePublic(new X509EncodedKeySpec(keyBytes));

                logger.info("Loaded JWT public key for gateway rate limiting from {}", publicKeyPath);
                return Jwts.parserBuilder().setSigningKey(publicKey).build();
            }
        } catch (Exception exception) {
            throw new IllegalStateException(
                    "Unable to load JWT public key for gateway rate limiting from " + publicKeyPath,
                    exception);
        }
    }

    @Bean
    KeyResolver chatUserKeyResolver(JwtParser chatRateLimitJwtParser) {
        return exchange -> Mono.just(resolveKey(
                exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION),
                chatRateLimitJwtParser));
    }

    static String resolveKey(String authorization, JwtParser parser) {
        if (authorization == null || !authorization.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return UNAUTHENTICATED_KEY;
        }

        String token = authorization.substring(7).trim();
        if (token.isEmpty()) {
            return UNAUTHENTICATED_KEY;
        }

        try {
            String subject = parser.parseClaimsJws(token).getBody().getSubject();
            if (subject == null || subject.isBlank()) {
                return UNAUTHENTICATED_KEY;
            }
            return "chat:user:" + subject;
        } catch (Exception ignored) {
            // Invalid and expired tokens share a small bucket. The chat service
            // still owns the actual 401 response for requests that pass it.
            return UNAUTHENTICATED_KEY;
        }
    }
}
