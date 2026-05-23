package com.claudiordese.session.infrastructure.security;

import com.claudiordese.session.application.domain.IssuedToken;
import com.claudiordese.session.application.domain.User;
import com.claudiordese.session.application.port.TokenIssuer;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Duration;
import java.util.Base64;
import java.util.Date;

@Component
public class JwtTokenIssuer implements TokenIssuer {

    @Value("${jwt.private-key.path}")
    private String privateKeyPath;

    private PrivateKey privateKey;

    @PostConstruct
    void init() {
        try {
            this.privateKey = loadPrivateKey(privateKeyPath);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to load JWT private key", e);
        }
    }

    @Override
    public IssuedToken issue(User user, Duration ttl) {
        long ttlMs = ttl.toMillis();
        String token = Jwts.builder()
                .setSubject(user.id().toString())
                .claim("roles", user.roles())
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + ttlMs))
                .signWith(privateKey, SignatureAlgorithm.RS256)
                .compact();
        return new IssuedToken(token, ttl.toSeconds());
    }

    private PrivateKey loadPrivateKey(String filename) throws Exception {
        try (InputStream in = getClass().getClassLoader().getResourceAsStream(filename)) {
            if (in == null) throw new IllegalStateException("Private key not found: " + filename);
            String pem = new String(in.readAllBytes())
                    .replace("-----BEGIN PRIVATE KEY-----", "")
                    .replace("-----END PRIVATE KEY-----", "")
                    .replaceAll("\\s+", "");
            byte[] bytes = Base64.getDecoder().decode(pem);
            return KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(bytes));
        }
    }
}
