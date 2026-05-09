package com.claudiordese.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.InputStream;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

public class JwtValidator {

    private static final Logger logger = LoggerFactory.getLogger(JwtValidator.class);

    private final PublicKey publicKey;

    public JwtValidator(String publicKeyPath) {
        this.publicKey = loadPublicKey(publicKeyPath);
        logger.info("JWT public key loaded from {}", publicKeyPath);
    }

    public Claims validateToken(String token) throws JwtException {
        return Jwts.parserBuilder()
                .setSigningKey(publicKey)
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    public boolean isTokenValid(String token) {
        try {
            validateToken(token);
            return true;
        } catch (JwtException e) {
            return false;
        }
    }

    public String getUsername(String token) throws JwtException {
        return validateToken(token).getSubject();
    }

    private static PublicKey loadPublicKey(String path) {
        try (InputStream inputStream = JwtValidator.class.getClassLoader().getResourceAsStream(path)) {
            if (inputStream == null) {
                throw new IllegalStateException("Public key not found at " + path);
            }
            String key = new String(inputStream.readAllBytes())
                    .replace("-----BEGIN PUBLIC KEY-----", "")
                    .replace("-----END PUBLIC KEY-----", "")
                    .replaceAll("\\s+", "");
            byte[] keyBytes = Base64.getDecoder().decode(key);
            X509EncodedKeySpec spec = new X509EncodedKeySpec(keyBytes);
            return KeyFactory.getInstance("RSA").generatePublic(spec);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to load JWT public key from " + path, e);
        }
    }
}
