package com.claudiordese.session.util;

import com.claudiordese.exceptions.NotFound;
import com.claudiordese.exceptions.TokenExpired;
import com.claudiordese.exceptions.TokenRevoked;
import com.claudiordese.session.entity.RefreshToken;
import com.claudiordese.session.entity.User;
import com.claudiordese.session.repository.RefreshTokenRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;

@Component
public class JwtUtils {

    private PrivateKey PRIVATE_KEY;

    @Value("${jwt.private-key.path}")
    private String privateKeyPath;

    private final RefreshTokenRepository refreshTokenRepository;

    public JwtUtils(RefreshTokenRepository refreshTokenRepository) {
        this.refreshTokenRepository = refreshTokenRepository;
    }

    @PostConstruct
    void init() {
        try {
            this.PRIVATE_KEY = loadPrivateKey(privateKeyPath);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to load JWT private key",e);
        }
    }

    public String generateToken(User user, long expirationMs) {
        return Jwts.builder()
                .setSubject(user.getId().toString())
                .claim("role", user.getRoles().getFirst())
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + expirationMs))
                .signWith(PRIVATE_KEY, SignatureAlgorithm.RS256)
                .compact();
    }

    private PrivateKey loadPrivateKey(String filename) throws Exception {
        try (InputStream inputStream = getClass().getClassLoader().getResourceAsStream(filename)) {
            if(inputStream == null) {
                throw new IllegalStateException("Private key not found " + filename);
            }
            String key = new String(inputStream.readAllBytes())
                    .replace("-----BEGIN PRIVATE KEY-----", "")
                    .replace("-----END PRIVATE KEY-----", "")
                    .replaceAll("\\s+", "");
            byte[] keyBytes = Base64.getDecoder().decode(key);
            PKCS8EncodedKeySpec spec = new PKCS8EncodedKeySpec(keyBytes);

            return KeyFactory.getInstance("RSA").generatePrivate(spec);
        }
    }

    public RefreshToken verifyRefreshToken(String token) throws NotFound {
        RefreshToken refreshToken = refreshTokenRepository.findByToken(token)
                .orElseThrow(() -> new NotFound("not_found", "Token not found"));

        if (refreshToken.isRevoked()) {
            throw new TokenRevoked("token_revoked", "Token has been revoked");
        }

        if (refreshToken.getExpiryDate().isBefore(Instant.now())) {
            refreshTokenRepository.delete(refreshToken);
            throw new TokenExpired("token_expired", "Token has expired");
        }

        return refreshToken;
    }
}
